'use strict';

/* =========================================================================
 * homepageService.js — Service layer for homepage data
 *
 * This service handles the logic for gathering homepage summary data,
 * including KPIs, active models and performance trends.
 * ========================================================================= */

const { getPerformanceData } = require('./logService');

async function getHomepageData() {
    // Get performance data to build homepage metrics
    const performanceData = await getPerformanceData({ date: null });
    
    // Build KPIs (this logic was originally in script.js)
    const kpis = {
        totalModels: performanceData.models?.length || 0,
        totalSessions: performanceData.sessions?.length || 0,
        totalTokensProcessed: performanceData.totalTokensProcessed || 0,
        avgPromptTps: performanceData.avgPromptTps || 0,
        avgGenTps: performanceData.avgGenTps || 0
    };
    
    // Active models (this logic was originally in script.js)
    const activeModels = [];
    if (performanceData.sessions && Array.isArray(performanceData.sessions)) {
        for (const session of performanceData.sessions) {
            // Extract model name from the file path  
            let modelName = 'Unknown';
            if (session.model) {
                try {
                    const parts = session.model.split('/');
                    modelName = parts[parts.length - 1];
                } catch (e) {
                    modelName = session.model;
                }
            }
            
            activeModels.push({
                name: modelName,
                family: extractModelFamily(modelName),
                parameters: extractParameters(modelName),
                quantization: extractQuantization(modelName),
                format: extractFormat(modelName),
                genTps: session.genTps || 0,
                promptTps: session.promptTps || 0,
                lastActivity: session.endTs || session.startTs
            });
        }
    }
    
    // Performance trends (simplified for now)
    const performanceTrends = {
        genTpsData: [],
        promptTpsData: []
    };
    
    return {
        kpis,
        activeModels, 
        performanceTrends
    };
}

function extractModelFamily(modelName) {
    if (!modelName) return 'Unknown';
    // Simple extraction logic based on common naming conventions
    const lowerName = modelName.toLowerCase();
    if (lowerName.includes('llama')) return 'LLaMA';
    if (lowerName.includes('mistral')) return 'Mistral';
    if (lowerName.includes('gemma')) return 'Gemma'; 
    if (lowerName.includes('phi')) return 'Phi';
    if (lowerName.includes('qwen')) return 'Qwen';
    if (lowerName.includes('command')) return 'Command';
    return 'Other';
}

function extractParameters(modelName) {
    if (!modelName) return 'Unknown';
    const matches = modelName.match(/(\d+)(?:b|g)/i);
    return matches ? `${matches[1]}B` : 'Unknown';
}

function extractQuantization(modelName) {
    if (!modelName) return '';
    
    // Look for common quantization patterns
    if (modelName.includes('Q4')) return 'Q4';
    if (modelName.includes('Q5')) return 'Q5'; 
    if ( modelName.includes('Q6')) return 'Q6';
    if (modelName.includes('FP16')) return 'FP16';
    if (modelName.includes('INT8')) return 'INT8';
    return '';
}

function extractFormat(modelName) {
    if (!modelName) return '';
    
    // Look for common formats
    if (modelName.endsWith('.gguf')) return 'GGUF';
    if (modelName.endsWith('.bin')) return 'BIN'; 
    if (modelName.endsWith('.pt') || modelName.endsWith('.pth')) return 'PYTORCH';
    return '';
}

module.exports = {
    getHomepageData
};