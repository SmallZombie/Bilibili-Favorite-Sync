exports.execute = execute;


const { pauseTo } = require("../Main");


function execute(args) {
    return new Promise((resolve, reject) => {
        if (args.length === 0) {
            reject("参数错误");
            return;
        }
        if (args.length % 2 !== 0) {
            reject('缺少参数');
            return;
        }

        let time = 0; // ms
        for (let i = 0; i < args.length; i++) {
            if (i % 2 !== 0) continue;
            const arg = Number(args[i + 1]);

            if (!args[i].startsWith('-')) {
                reject('参数错误：' + args[i]);
                return;
            }
            if (arg === NaN) {
                reject('参数错误：' + args[i + 1]);
                return;
            }

            switch (args[i]) {
                case '-d': { // 天
                    time += arg * 1000 * 60 * 60 * 24;
                    break;
                }
                case '-h': { // 时
                    time += arg * 1000 * 60 * 60;
                    break;
                }
                case '-m': { // 分
                    time += arg * 1000 * 60;
                    break;
                }
                case '-s': { // 秒
                    time += arg * 1000;
                    break;
                }
                default: {
                    reject('参数错误：' + args[i]);
                    return;
                }
            }
        }

        pauseTo(time);
        resolve();
    });
}
