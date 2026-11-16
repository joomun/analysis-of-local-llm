"use strict";

const levels = {
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
};

function log(level, msg) {
    const ts = new Date().toISOString();
    console.log(`${ts} ${levels[level]}: ${msg}`);
}

module.exports = {
    info: (msg) => log('info', msg),
    warn: (msg) => log('warn', msg),
    error: (msg, err) => {
        if (err && err.message) {
            log('error', `${msg} - ${err.message}`);
        } else {
            log('error', msg);
        }
    },
};