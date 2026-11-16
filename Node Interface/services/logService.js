'use strict';

/* =========================================================================
 * logService.js — Service layer for log parsing operations
 *
 * This service layer handles business logic for log data processing,
 * separating it from the route handlers and providing a reusable interface.
 * ========================================================================= */

const { getLogRoot, listDates, getPerformanceData } = require('../parsers/logParser');

// Export functions that were originally in the server file 
function listDatesFn() {
    return listDates();
}

function getPerformanceDataFn(options) {
    return getPerformanceData(options);
}

module.exports = {
    listDates: listDatesFn,
    getPerformanceData: getPerformanceDataFn
};