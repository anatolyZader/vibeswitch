/**
 * Tests for DashboardChatService with multiple provider support
 */

const DashboardChatService = require('../../../business_modules/dashboard-chat/app/DashboardChatService');

describe('DashboardChatService', () => {
    describe('getConfig', () => {
        it('should return default config when vscode is not provided', () => {
            const config = DashboardChatService.getConfig(null);
            expect(config).toEqual({
                enabled: false,
                provider: 'openai',
                apiKey: '',
                model: 'gpt-4o-mini',
                useWorkspaceContext: true,
                includeKeyFiles: true,
                timeoutMs: 15000
            });
        });

        it('should support OpenAI provider configuration', () => {
            const mockVscode = {
                workspace: {
                    getConfiguration: jest.fn(() => ({
                        get: jest.fn((key, defaultValue) => {
                            const settings = {
                                'dashboardChat.enabled': true,
                                'dashboardChat.provider': 'openai',
                                'dashboardChat.openai.apiKey': 'sk-test-key',
                                'dashboardChat.openai.model': 'gpt-4',
                                'dashboardChat.useWorkspaceContext': true,
                                'dashboardChat.includeKeyFiles': true,
                                'dashboardChat.timeoutMs': 15000
                            };
                            return settings[key] !== undefined ? settings[key] : defaultValue;
                        })
                    }))
                }
            };

            const config = DashboardChatService.getConfig(mockVscode);
            expect(config.provider).toBe('openai');
            expect(config.apiKey).toBe('sk-test-key');
            expect(config.model).toBe('gpt-4');
        });

        it('should support Claude provider configuration', () => {
            const mockVscode = {
                workspace: {
                    getConfiguration: jest.fn(() => ({
                        get: jest.fn((key, defaultValue) => {
                            const settings = {
                                'dashboardChat.enabled': true,
                                'dashboardChat.provider': 'claude',
                                'dashboardChat.claude.apiKey': 'sk-ant-test-key',
                                'dashboardChat.claude.model': 'claude-3-5-sonnet-20241022',
                                'dashboardChat.useWorkspaceContext': true,
                                'dashboardChat.includeKeyFiles': true,
                                'dashboardChat.timeoutMs': 15000
                            };
                            return settings[key] !== undefined ? settings[key] : defaultValue;
                        })
                    }))
                }
            };

            const config = DashboardChatService.getConfig(mockVscode);
            expect(config.provider).toBe('claude');
            expect(config.apiKey).toBe('sk-ant-test-key');
            expect(config.model).toBe('claude-3-5-sonnet-20241022');
        });

        it('should fall back to llm.openai settings for OpenAI provider', () => {
            const mockVscode = {
                workspace: {
                    getConfiguration: jest.fn(() => ({
                        get: jest.fn((key, defaultValue) => {
                            const settings = {
                                'dashboardChat.enabled': true,
                                'dashboardChat.provider': 'openai',
                                'dashboardChat.openai.apiKey': '',
                                'llm.openai.apiKey': 'sk-fallback-key',
                                'llm.openai.model': 'gpt-4o-mini',
                                'dashboardChat.useWorkspaceContext': true,
                                'dashboardChat.includeKeyFiles': true,
                                'dashboardChat.timeoutMs': 15000
                            };
                            return settings[key] !== undefined ? settings[key] : defaultValue;
                        })
                    }))
                }
            };

            const config = DashboardChatService.getConfig(mockVscode);
            expect(config.apiKey).toBe('sk-fallback-key');
            expect(config.model).toBe('gpt-4o-mini');
        });
    });

    describe('reply', () => {
        it('should return error when chat is disabled', async () => {
            const mockVscode = {
                workspace: {
                    getConfiguration: jest.fn(() => ({
                        get: jest.fn((key, defaultValue) => {
                            if (key === 'dashboardChat.enabled') return false;
                            return defaultValue;
                        })
                    }))
                }
            };

            const result = await DashboardChatService.reply(mockVscode, {}, 'test message');
            expect(result.text).toBeNull();
            expect(result.error).toContain('disabled');
        });

        it('should return error when no API key is set for OpenAI', async () => {
            const mockVscode = {
                workspace: {
                    getConfiguration: jest.fn(() => ({
                        get: jest.fn((key, defaultValue) => {
                            const settings = {
                                'dashboardChat.enabled': true,
                                'dashboardChat.provider': 'openai',
                                'dashboardChat.openai.apiKey': '',
                                'llm.openai.apiKey': ''
                            };
                            return settings[key] !== undefined ? settings[key] : defaultValue;
                        })
                    }))
                }
            };

            const result = await DashboardChatService.reply(mockVscode, {}, 'test message');
            expect(result.text).toBeNull();
            expect(result.error).toContain('OpenAI');
            expect(result.error).toContain('API key');
        });

        it('should return error when no API key is set for Claude', async () => {
            const mockVscode = {
                workspace: {
                    getConfiguration: jest.fn(() => ({
                        get: jest.fn((key, defaultValue) => {
                            const settings = {
                                'dashboardChat.enabled': true,
                                'dashboardChat.provider': 'claude',
                                'dashboardChat.claude.apiKey': ''
                            };
                            return settings[key] !== undefined ? settings[key] : defaultValue;
                        })
                    }))
                }
            };

            const result = await DashboardChatService.reply(mockVscode, {}, 'test message');
            expect(result.text).toBeNull();
            expect(result.error).toContain('Claude');
            expect(result.error).toContain('API key');
        });
    });
});
