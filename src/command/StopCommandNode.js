exports.execute = execute;


function execute(...args) {
    return new Promise((resolve, reject) => {
        process.exit();
    })
}
