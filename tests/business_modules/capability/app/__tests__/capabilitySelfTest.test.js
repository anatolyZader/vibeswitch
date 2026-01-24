/**
 * Tests for CapabilitySelfTest
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

jest.mock('fs');
jest.mock('child_process');

const CapabilitySelfTest = require('../../../../../business_modules/capability/app/capabilitySelfTest');

describe('CapabilitySelfTest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        fs.existsSync.mockReturnValue(true);
        fs.accessSync.mockImplementation(() => {});
        execSync.mockImplementation(() => Buffer.from('/usr/bin/jq'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('run', () => {
        it('should pass when all requirements are met', () => {
            const selfTest = new CapabilitySelfTest();
            const result = selfTest.run();
            expect(result.passed).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail when jq is not installed', () => {
            execSync.mockImplementation(() => { throw new Error('not found'); });
            const selfTest = new CapabilitySelfTest();
            const result = selfTest.run();
            expect(result.passed).toBe(false);
            expect(result.errors.some(e => e.includes('jq'))).toBe(true);
        });

        it('should fail when hook script is missing', () => {
            fs.existsSync.mockImplementation((p) => !p.includes('gate-shell.sh'));
            const selfTest = new CapabilitySelfTest();
            const result = selfTest.run();
            expect(result.passed).toBe(false);
            expect(result.errors.some(e => e.includes('gate-shell.sh'))).toBe(true);
        });

        it('should fail when hook script is not executable', () => {
            fs.accessSync.mockImplementation((p, mode) => {
                if (p.includes('gate-mcp.sh') && mode === fs.constants.X_OK) throw new Error();
            });
            const selfTest = new CapabilitySelfTest();
            const result = selfTest.run();
            expect(result.passed).toBe(false);
        });

        it('should warn when config file is missing', () => {
            fs.existsSync.mockImplementation((p) => !p.includes('mode.json'));
            const selfTest = new CapabilitySelfTest();
            const result = selfTest.run();
            expect(result.warnings.some(w => w.includes('mode.json'))).toBe(true);
        });
    });

    describe('getLastResult', () => {
        it('should return null before first run', () => {
            const selfTest = new CapabilitySelfTest();
            expect(selfTest.getLastResult()).toBeNull();
        });

        it('should return last result after run', () => {
            const selfTest = new CapabilitySelfTest();
            selfTest.run();
            expect(selfTest.getLastResult()).not.toBeNull();
        });
    });

    describe('startPeriodic', () => {
        it('should run immediately on start', () => {
            const selfTest = new CapabilitySelfTest();
            selfTest.startPeriodic(jest.fn());
            expect(selfTest.getLastResult()).not.toBeNull();
        });

        it('should call onFailure when test fails', () => {
            execSync.mockImplementation(() => { throw new Error(); });
            const selfTest = new CapabilitySelfTest();
            const onFailure = jest.fn();
            selfTest.startPeriodic(onFailure);
            expect(onFailure).toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        it('should stop periodic testing', () => {
            const selfTest = new CapabilitySelfTest();
            selfTest.startPeriodic(jest.fn());
            selfTest.dispose();
            jest.advanceTimersByTime(10 * 60 * 1000);
        });
    });
});
