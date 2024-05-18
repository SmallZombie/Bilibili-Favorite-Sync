const { getLibraryConfig, save } = require("../config/Global");

exports.execute = execute;


function execute(args) {
    return new Promise((resolve, reject) => {
        switch (args[0]) {
            case 'enable': {
                getLibraryConfig().filter.blacklist.enable = false;
                getLibraryConfig().filter.whitelist.enable = true;

                save();

                resolve('白名单已启用');
                break;
            }
            case 'disable': {
                getLibraryConfig().filter.whitelist.enable = false;

                save();

                resolve('白名单已禁用');
                break;
            }
            case 'detail': {
                let str = `白名单当前${getLibraryConfig().filter.whitelist.enable ? '已启用' : '已禁用'} (${getLibraryConfig().filter.whitelist.list.length})\n`;
                for (const i of getLibraryConfig().filter.whitelist.list) {
                    const item = getLibraryConfig().favorites.find(v => v.id === Number(i));
                    str += `- ${i} ${item ? `\t(${item.title})` : '[无效]'} \n`;
                }

                resolve(str);
                break;
            }
            case 'add': {
                if (!args[1]) {
                    reject('参数错误');
                    return;
                }

                const arg = Number(args[1]);

                if (getLibraryConfig().filter.whitelist.list.includes(arg)) {
                    resolve('重复添加');
                    return;
                }

                getLibraryConfig().filter.whitelist.list.push(arg);
                save();

                resolve('添加成功');
                break;
            }
            case 'remove': {
                if (!args[1]) {
                    reject('参数错误');
                    return;
                }

                const arg = Number(args[1]);

                getLibraryConfig().filter.whitelist.list = getLibraryConfig().filter.whitelist.list.filter(i => i !== arg);
                save();

                resolve('移除成功');
                break;
            }
            default: {
                reject('参数错误');
            }
        }
    });
}
