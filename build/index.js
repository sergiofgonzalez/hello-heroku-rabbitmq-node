"use strict";

var log4js = require("log4js");
var config = require("./lib/config");
var ampq = require("amqplib/callback_api");

var logger = log4js.getLogger("main");
logger.setLevel(config("LOG_LEVEL"));


var amqpConnection = null;
var pubChannel = null;
var offlinePubQueue = [];


function start() {
  ampq.connect(config("CLOUDAMQP_URL") + "?heartbeat=60", function establishConnection(err, connection) {
    if (err) {
      logger.error("Error while establishing connection to the AMQP instance; retry will be attempted; error:", err);
      return setTimeout(start, config("CLOUDAMQP_CONNECTION_RETRY_MSEC"));
    }

    /* set up AMQP connection error handler */
    connection.on("error", function (err) {
      if (err.message !== "Connection closing") {
        logger.error("Established connection is reporting error: ", err);
      }
    });

    /* set up AMQP close connection handler */
    connection.on("close", function() {
      logger.error("Connection with AMQP instance has been lost; retry will be attempted");
      return setTimeout(start, config("CLOUDAMQP_CONNECTION_RETRY_MSEC"));
    });

    /* Notification that connection has been successfully established */
    logger.debug("A connection with the AMQP instance has been successfully established!");
    amqpConnection = connection;

    whenConnected();
  });
}

function whenConnected() {
  logger.debug("Connection to AMQP instance successfully performed");
  startPublisher();
  startConsumer();
}

function startPublisher() {
  /* opens a channel using the confirmation mode which requires each published message to be acked or nacked */
  amqpConnection.createConfirmChannel(function establishChannelOnConnection(err, channel) {
    if (closeOnErr(err)) {
      return;
    }

    /* set up AMQP channel error handler */
    channel.on("error", function (err) {
      logger.error("Error establishing channel on existing connection; error:", err);
    });

    /* set up AMQP channel close handler */
    channel.on("close", function() {
      logger.debug("AMQP publishing channel has been closed");
    });

    pubChannel = channel;

    /* push messages from internal queue for messages that could not be sent */
    while (true) {
      var message = offlinePubQueue.shift();
      if (!message) {
        break;
      }
      publish(message[0], message[1], message[2]);
    }
  });
}

function publish(exchange, routingKey, content) {
  try {
    pubChannel.publish(exchange, routingKey, content, {persistent: true}, function (err) {
      if (err) {
        logger.error("Error publishing message", err);
        offlinePubQueue.push([exchange, routingKey, content]);
        pubChannel.connection.close();
      }
      logger.debug("message successfully published: ", content.toString());
    });
  } catch (e) {
    logger.error("Exception caught publishing message: ", e.message);
    logger.debug("Message will be sent to the offline queue for further processing: exchange:" + exchange + ", routingKey=" + routingKey + ", content=" + content);
    offlinePubQueue.push([exchange, routingKey, content]);
  }
}

function startConsumer() {
  amqpConnection.createChannel(function (err, channel) {
    if (closeOnErr(err)) {
      return;
    }
    /* set up AMQP channel error handler */
    channel.on("error", function (err) {
      logger.error("Error creating the channel to consume messages", err);
    });

    /* set up AMQP channel close handler */
    channel.on("close", function () {
      logger.debug("AMQP consuming channel has been closed");
    });

    channel.prefetch(10);
    channel.assertQueue("jobs", {durable: true, arguments: {"x-message-ttl": 60000, "x-dead-letter-exchange": "\"\"", "x-dead-letter-routing-key": "errors"}}, function (err) {
      if (closeOnErr(err)) {
        logger.error("Error asserting queue properties: ", err);
        return;
      }
      channel.consume("jobs", processMessage, {noAck: false});
      logger.debug("Consumer has been started!: ");
    });


    function processMessage(msg) {
      work(msg, function (err, results) {
        try {
          if (!err) {
            channel.ack(msg);
            logger.debug("Message has been successfully retrieved: removing from queue; results: ", results);
          } else {
            channel.reject(msg, true);
          }
        } catch (e) {
          closeOnErr(e);
        }
      });
    }
  });
}


function work(msg, cb) {
  logger.debug("Simulating work on: ", msg.content.toString());
  cb(null, "message: " + msg.content.toString() + " has been processed");
}


function closeOnErr(err) {
  if (!err) {
    return false;
  }
  logger.debug("Error has been found processing AMQP actions:", err);
  amqpConnection.close();
  return true;
}

function startPublishingMessages() {
  var i = 0;
  setInterval(function() {
    publish("", "jobs", new Buffer("Message #" + i + " published at " + getCurrentTime()));
    ++i;
  }, 2500);
}


start();

startPublishingMessages();

function getCurrentTime() {
  return JSON.parse(JSON.stringify(new Date()));
}
