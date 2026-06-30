class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
    }
}

class BusinessRuleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BusinessRuleError';
        this.statusCode = 422;
    }
}

module.exports = { NotFoundError, ValidationError, BusinessRuleError };