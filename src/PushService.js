exports.PushService = class PushService {
    logger;

    constructor(logger) {
        this.logger = logger;
    }


    push(msg, ...args) {
        this.logger.err(msg);
    }
}
