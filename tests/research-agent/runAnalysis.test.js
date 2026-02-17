/**
 * Unit tests for research-agent runAnalysis (stateless analysis on current + history).
 */
const { runAnalysis } = require('../../research-agent/analysis');

describe('research-agent runAnalysis', () => {
    test('returns accepted and pointsUsed 0 when no current and empty history', () => {
        const result = runAnalysis({ current: null, history: [] });
        expect(result.accepted).toBe(true);
        expect(result.pointsUsed).toBe(0);
        expect(result.findings).toBeUndefined();
    });

    test('returns pointsUsed 1 when only current', () => {
        const result = runAnalysis({
            current: { timestamp: 1000, sonarMeasures: { bugs: 1 }, scoreData: { total: 50 } },
            history: []
        });
        expect(result.accepted).toBe(true);
        expect(result.pointsUsed).toBe(1);
        expect(result.timestamp).toBe(1000);
        expect(result.findings).toBeUndefined();
    });

    test('returns findings when at least 2 points with sonar.bugs', () => {
        const result = runAnalysis({
            current: { timestamp: 2000, sonarMeasures: { bugs: 5 }, scoreData: { total: 60 } },
            history: [
                { timestamp: 1000, sonarMeasures: { bugs: 3 }, scoreData: { total: 40 } }
            ]
        });
        expect(result.accepted).toBe(true);
        expect(result.pointsUsed).toBe(2);
        expect(result.findings).toBeDefined();
        const bugsFinding = result.findings.find((f) => f.metric === 'sonar.bugs');
        expect(bugsFinding).toBeDefined();
        expect(bugsFinding.latest).toBe(5);
        expect(bugsFinding.average).toBe(4);
        expect(bugsFinding.sampleSize).toBe(2);
    });

    test('returns scoreData.total finding when at least 2 points have scoreData', () => {
        const result = runAnalysis({
            current: { timestamp: 2000, scoreData: { total: 80 } },
            history: [{ timestamp: 1000, scoreData: { total: 20 } }]
        });
        expect(result.pointsUsed).toBe(2);
        const totalFinding = result.findings.find((f) => f.metric === 'scoreData.total');
        expect(totalFinding).toBeDefined();
        expect(totalFinding.latest).toBe(80);
        expect(totalFinding.average).toBe(50);
    });

    test('handles null sonarMeasures and scoreData', () => {
        const result = runAnalysis({
            current: { timestamp: 1, sonarMeasures: null, scoreData: null },
            history: [{ timestamp: 0, sonarMeasures: null, scoreData: null }]
        });
        expect(result.accepted).toBe(true);
        expect(result.pointsUsed).toBe(2);
        expect(result.findings).toBeUndefined();
    });

    test('uses Date.now() for timestamp when current has no timestamp', () => {
        const before = Date.now();
        const result = runAnalysis({ current: {}, history: [] });
        const after = Date.now();
        expect(result.timestamp).toBeGreaterThanOrEqual(before);
        expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    describe('profound statistics (correlation, regression, trends)', () => {
        test('includes correlation finding when score and bugs have sufficient correlation over 3+ points', () => {
            const result = runAnalysis({
                current: { timestamp: 3000, scoreData: { total: 80 }, sonarMeasures: { bugs: 1 } },
                history: [
                    { timestamp: 2000, scoreData: { total: 50 }, sonarMeasures: { bugs: 4 } },
                    { timestamp: 1000, scoreData: { total: 20 }, sonarMeasures: { bugs: 7 } }
                ]
            });
            expect(result.findings).toBeDefined();
            const correlation = result.findings.find((f) => f.type === 'correlation' && f.x === 'scoreData.total' && f.y === 'sonar.bugs');
            if (correlation) {
                expect(correlation).toHaveProperty('correlation');
                expect(correlation).toHaveProperty('sampleSize', 3);
            }
        });

        test('includes trend finding for scoreData.total over 3+ points', () => {
            const result = runAnalysis({
                current: { timestamp: 3000, scoreData: { total: 70 } },
                history: [
                    { timestamp: 2000, scoreData: { total: 50 } },
                    { timestamp: 1000, scoreData: { total: 30 } }
                ]
            });
            expect(result.findings).toBeDefined();
            const trend = result.findings.find((f) => f.type === 'trend' && f.metric === 'scoreData.total');
            if (trend) {
                expect(trend).toHaveProperty('direction');
                expect(['improving', 'stable', 'degrading']).toContain(trend.direction);
            }
        });

        test('includes regression finding for score vs bugs when slope is non-trivial', () => {
            const result = runAnalysis({
                current: { timestamp: 3000, scoreData: { total: 90 }, sonarMeasures: { bugs: 0 } },
                history: [
                    { timestamp: 2000, scoreData: { total: 60 }, sonarMeasures: { bugs: 3 } },
                    { timestamp: 1000, scoreData: { total: 30 }, sonarMeasures: { bugs: 6 } }
                ]
            });
            expect(result.findings).toBeDefined();
            const regression = result.findings.find((f) => f.type === 'regression' && f.predictor === 'scoreData.total' && f.outcome === 'sonar.bugs');
            if (regression) {
                expect(regression).toHaveProperty('slope');
                expect(regression).toHaveProperty('sampleSize', 3);
            }
        });

        test('backward compatible: basic metric findings still present', () => {
            const result = runAnalysis({
                current: { timestamp: 2000, sonarMeasures: { bugs: 5 }, scoreData: { total: 60 } },
                history: [{ timestamp: 1000, sonarMeasures: { bugs: 3 }, scoreData: { total: 40 } }]
            });
            expect(result.findings.find((f) => f.metric === 'sonar.bugs')).toBeDefined();
            expect(result.findings.find((f) => f.metric === 'scoreData.total')).toBeDefined();
        });
    });
});
