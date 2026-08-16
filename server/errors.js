export class AppError extends Error {
    constructor(message, status = 500, code = 'request_failed') {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
    }
}
