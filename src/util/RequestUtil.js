exports.fetchEx = fetchEx;


const { getLibraryConfig, logger, G_DEBUG } = require("../config/Global");
const { timeout } = require("./BaseUtil");


/** 封装的 fetch，失败时默认重试 5 次 */
function fetchEx(url, ops = {}) {
    if (ops.retry === void 0) ops.retry = 5;

    return fetch(url, Object.assign(ops, {
        headers: {
            Cookie: 'SESSDATA=' + getLibraryConfig().account.token,
            'User-Agent': getLibraryConfig().account.user_agent
        }
    })).then(res => res.json()).catch(async e => {
        if (ops.retry >= 0) {
            logger.err('请求失败，剩余重试次数：' + ops.retry--);
            if (G_DEBUG && e) logger.err(e);

            await timeout(10000);
            return fetchEx(url, ops);
        }
    });
}
