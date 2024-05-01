exports.timeout = timeout;


function timeout(time) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, time);
    });
}
