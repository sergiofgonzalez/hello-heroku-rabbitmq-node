"use strict";

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
    clean: {
      build: ["build"]
    },
    jshint: {
      options: {
        jshintrc: true, // search for .jshintrc files relative to the files being linted
        reporter: require("jshint-stylish")
      },
      sources: {
        src: ["public/src/**/*.js", "public/src/lib/**/*.js", "public/test/**/*.js"]
      },
      build: {
        src: ["Gruntfile.js"]
      }
    },
    tape: {
      dev: ["public/test/*.js"]
    },
    copy: {
      build: {
        expand: true,
        cwd: "public/src",
        src: ["**/*.js", "**/*.json"],
        dest: "build"
      },
    },
    watch: {
      cfg: {
        files: ["package.json"],
        tasks: ["build"]
      },
      sources: {
        files: ["public/src/**/*.js", "public/src/lib/**/*.js", "public/test/**/*.js"],
        tasks: ["build"]
      },
      resources: {
        files: ["public/src/**/*.json"],
        tasks: ["build"]
      },
      rebuild: {
        files: ["Gruntfile.js"],
        tasks: ["build"]
      }
    }
  });

  grunt.loadNpmTasks("grunt-contrib-clean");
  grunt.loadNpmTasks("grunt-contrib-copy");
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-tape");
  grunt.loadNpmTasks("grunt-contrib-watch");

  grunt.registerTask("test", "Runs the tape test found in `src/test`", ["tape:dev"]);
  grunt.registerTask("build", "Prepares a release build in `build/`", ["clean:build", "jshint", "test", "copy:build"]);
  grunt.registerTask("dev", "Continuous development mode", function() {
    grunt.log.ok("running `watch` task...");
    grunt.task.run(["build", "watch"]);
  });
};
