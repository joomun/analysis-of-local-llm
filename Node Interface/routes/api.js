'use strict';

/* =========================================================================
 * api.js — API Routes for Local LLM Performance Monitor
 *
 * Centralized route handlers that delegate to services.
 * ========================================================================= */

const express = require('express');
const router = express.Router();

// Import service functions 
const { listDates, getPerformanceData } = require('../services/logService');

// Available log dates for the filter dropdown
router.get('/dates', (req, res) => {
    try {
        const data = listDates();
        res.json({ logRoot: process.env.LOG_ROOT || 'not set', dates: data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list log dates', details: err.message });
    }
});

// Metrics for a date (or all logs when no date is given)
router.get('/performance-data', (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date.trim() : null;
        const data = getPerformanceData({ date: date || null });
        res.json({ timestamp: new Date().toISOString(), ...data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to parse logs', details: err.message });
    }
});

// Homepage summary data - now in a dedicated service
router.get('/homepage', async (req, res) => {
    try {
        const homepageService = require('../services/homepageService');
        const data = await homepageService.getHomepageData();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get homepage data', details: err.message });
    }
});

module.exports = router;