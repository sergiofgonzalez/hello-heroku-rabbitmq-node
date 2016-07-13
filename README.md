# Hello, RabbitMQ!
> basic example of RabbitMQ using Node.js and targetting Heroku PaaS

This example is heavily based on the fantastic set of blog entries of CloudAMQP (https://www.cloudamqp.com/blog/2015-05-18-part1-rabbitmq-for-beginners-what-is-rabbitmq.html)

# Description
The example assumes that there is a RabbitMQ instance already in place.

In the application, a connection will be established between the RabbitMQ instance and the worker. Queues and exchanges will be declared and created if they do not already exist and a message will be published.

The publish method will queue message internally if the connection is down and will try to resend them later using a simple local array defined in the application. Each of the items in the array will have the structure:
```javascript
[exchange, routingKey, content]
```
(so it's actually an array of arrays.)

The consumer will subscribe to the `jobs` queue which is defined with the following properties:
```javascript
durable: true                     // messages will be persisted to hard disk to survive node failures
x-message-ttl: 60000              // messages will expire after 60 seconds without having been acknowledged
x-dead-letter-exchange: ""        // for expired messages, use the default exchange (direct, use routing key as the destination queue)
x-dead-letter-routing-key: errors // use `errors` queue for expired messages
```

Messages, once retrieved, will be processed.

A new message will be published every second, using the default exchange (identified by the empty string `""`). The hard-wired behavior for the default exchange is the messages getting this exchange will be sent to the queue whose name matches the routing key.
