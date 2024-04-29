exports.execute = execute;


function execute(...args) {
    return new Promise((resolve, reject) => {
        resolve(`👍 帮助信息
- help
  查看帮助信息(你正在看)
- library list
  查看所有收藏夹和其状态
- library detail {<id> | n:<name>}
  查看收藏夹详细信息，使用 \`n:\` 前缀来进行模糊匹配，例如 \`library detail n:默认\`，最终会匹配到 "默认收藏夹" 或更多
- library {blacklist | whitelist} list
  查看黑/白名单和其启用状态
- library {blacklist | whitelist} add {<id> | n:<name>}
  向黑/白名单添加收藏夹
- library {blacklist | whitelist} remove {<id> | n:<name>}
  从黑/白名单移除收藏夹
- library {blacklist | whitelist} {enable | disable}
  启用/禁用黑/白名单
- stop
  停止同步
- start
  开始同步
- pause {-d <day> | -h <hour> | -m <minute> | -s <second>} [...]
  暂停同步至 n 后继续`);
    });
}
