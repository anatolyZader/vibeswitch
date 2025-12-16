/**
 * Test Helpers - Helper functions for common operations
 */

const helpers = {
    capitalize: (str) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    reverse: (str) => {
        return str.split('').reverse().join('');
    },
    
    truncate: (str, length) => {
        if (str.length <= length) return str;
        return str.substring(0, length) + '...';
    },
    
    slugify: (str) => {
        return str.toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },
    
    randomInt: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};

module.exports = helpers;
























