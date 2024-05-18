const { stop } = require("../Main");

exports.execute = execute;


function execute(args) {
    return new Promise((resolve, reject) => {
        stop();
        resolve();
    });
}
