// gitPubsubListener.js
'use strict';
/* eslint-disable no-unused-vars */

const fp = require('fastify-plugin');

async function gitPubsubListener(fastify, options) {
  const pubSubClient = fastify.diContainer.resolve('pubSubClient');
  // Git Module uses its own subscription for internal events (fetchRepoRequest, persistRepoRequest)
  // AI Module uses 'git-sub' for repoPushed events
  const subscriptionName = 'git-module-sub';
  const subscription = pubSubClient.subscription(subscriptionName);

  // Error handling for the subscription stream
  subscription.on('error', (error) => {
    fastify.log.error(`Pub/Sub Subscription Error (${subscriptionName}):`, error);
  });

  // Message handler for the subscription stream
  subscription.on('message', async (message) => {
    fastify.log.info(`Received git message ${message.id} on subscription ${subscriptionName}`);

    try {
      const data = JSON.parse(message.data.toString());

      if (data.event === 'fetchRepoRequest') {
        const { userId, repoId, correlationId } = data.payload;
        fastify.log.info(`Processing fetchRepo event for user: ${userId}, repo: ${repoId}, correlation: ${correlationId}`);
          const parts = repoId.split('/');
          if (parts.length !== 2) {
            fastify.log.error(`Invalid repoId format: ${repoId}. Expected format: owner/repo`);
            message.nack();
            return;
          }
          const [owner, repo] = parts;

        if (typeof fastify.fetchRepo === 'function') {
          // Create a DI scope for this Pub/Sub request
          const diScope = fastify.diContainer.createScope();
          
          // Create mock request object for fetchRepo with DI scope
          const mockRequest = {
            params: { owner, repo },
            user: { id: userId },
            headers: { 'x-correlation-id': correlationId },
            diScope: diScope // Add DI scope to request
          };
          const mockReply = {};

          // Call the same HTTP handler with mock request
          const repository = await fastify.fetchRepo(mockRequest, mockReply);
          
          fastify.log.info(`Repository fetched via PubSub: ${JSON.stringify(repository)}`);
          
          fastify.log.info(`Repository fetch result published for message ${message.id}`);
        } else {
          fastify.log.error(`fastify.fetchRepo is not defined. Cannot process message ${message.id}.`);
          message.nack();
          return;
        }

      } else if (data.event === 'fetchDocsRequest') {
        const { userId, repoId, correlationId } = data.payload;
        fastify.log.info(`Processing fetchDocs event for user: ${userId}, repo: ${repoId}, correlation: ${correlationId}`);

        if (typeof fastify.fetchDocs === 'function') {
          // Create a DI scope for this Pub/Sub request
          const diScope = fastify.diContainer.createScope();
          
          // Create mock request object for fetchDocs with DI scope
          const mockRequest = {
            params: { repoId },
            user: { id: userId },
            headers: { 'x-correlation-id': correlationId },
            diScope: diScope // Add DI scope to request
          };
          const mockReply = {};

          // Call the same HTTP handler with mock request
          const docs = await fastify.fetchDocs(mockRequest, mockReply);
          
          fastify.log.info(`Docs fetched via PubSub: ${JSON.stringify(docs)}`);
          
          fastify.log.info(`Docs fetch result published for message ${message.id}`);
        } else {
          fastify.log.error(`fastify.fetchDocs is not defined. Cannot process message ${message.id}.`);
          message.nack();
          return;
        }

      } else if (data.event === 'persistRepoRequest') {
        const { userId, repoId, correlationId, branch = 'main', forceUpdate = false, includeHistory = true } = data.payload;
        fastify.log.info(`Processing persistRepo event for user: ${userId}, repo: ${repoId}, branch: ${branch}, correlation: ${correlationId}`);
        
        const parts = repoId.split('/');
        if (parts.length !== 2) {
          fastify.log.error(`Invalid repoId format: ${repoId}. Expected format: owner/repo`);
          message.nack();
          return;
        }
        const [owner, repo] = parts;

        if (typeof fastify.persistRepo === 'function') {
          // Create a DI scope for this Pub/Sub request
          const diScope = fastify.diContainer.createScope();
          
          // Create mock request object for persistRepo with DI scope
          const mockRequest = {
            params: { owner, repo },
            body: { branch, forceUpdate, includeHistory },
            user: { id: userId },
            headers: { 'x-correlation-id': correlationId },
            diScope: diScope // Add DI scope to request
          };
          const mockReply = {};

          // Call the same HTTP handler with mock request
          const result = await fastify.persistRepo(mockRequest, mockReply);
          
          fastify.log.info(`Repository persisted via PubSub: ${JSON.stringify(result)}`);
          
          fastify.log.info(`Repository persistence result published for message ${message.id}`);
        } else {
          fastify.log.error(`fastify.persistRepo is not defined. Cannot process message ${message.id}.`);
          message.nack();
          return;
        }

      } else {
        fastify.log.warn(`Unknown event type "${data.event}" for message ${message.id}.`);
      }

      message.ack(); // Acknowledge the message upon successful processing
    } catch (error) {
      fastify.log.error(`Error processing git message ${message.id}:`, error);
      message.nack(); // Nack the message to re-queue it for another attempt
    }
  });

  fastify.log.info(`Listening for Git messages on Pub/Sub subscription: ${subscriptionName}...`);

  // Ensure the subscription is closed when the Fastify app closes
  fastify.addHook('onClose', async () => {
    fastify.log.info(`Closing Pub/Sub subscription: ${subscriptionName}.`);
    await subscription.close();
  });
}

module.exports = fp(gitPubsubListener);

// gitController.js
/* eslint-disable no-unused-vars */
'use strict';

const fp = require('fastify-plugin');

async function gitController(fastify, options) {


fastify.decorate('fetchRepo', async (request, reply) => {
    try {
      const { owner, repo } = request.params;
      const userId = request.user.id;
      const headerValue = request.headers['x-correlation-id'];
      const correlationId = (
        typeof headerValue === 'string' && headerValue.trim()
      )
      ? headerValue
      : `http-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      fastify.log.info(`Processing fetchRepo HTTP request for user: ${userId}, owner: ${owner}, repo: ${repo}`);
      
      // Check if diScope exists
      if (!request.diScope) {
        fastify.log.error('diScope not found in request object');
        throw new Error('Dependency injection scope not available');
      }

      fastify.log.info('Attempting to resolve gitService from DI container...');
      const gitService = await request.diScope.resolve('gitService');
      
      if (!gitService) {
        fastify.log.error('Git service not found in DI container');
        throw new Error('Git service not found in DI container');
      }

      fastify.log.info('gitService resolved successfully');

      const repoInGithubFormat = repo.includes('/') ? repo : `${owner}/${repo}`;
      fastify.log.info(`Calling gitService.fetchRepo with: userId=${userId}, repo=${repoInGithubFormat}, correlationId=${correlationId}`);
      
      try {
        const repository = await gitService.fetchRepo(userId, repoInGithubFormat, correlationId);
        fastify.log.info(`Repository fetched successfully`);
        return repository;
      } catch (serviceError) {
        fastify.log.error('Error from gitService.fetchRepo:', {
          message: serviceError.message,
          stack: serviceError.stack,
          name: serviceError.name,
          code: serviceError.code,
          status: serviceError.status,
          statusCode: serviceError.statusCode
        });
        throw serviceError;
      }
      
    } catch (error) {
      fastify.log.error('Error in fetchRepo controller:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        status: error.status,
        statusCode: error.statusCode,
        cause: error.cause
      });
      throw fastify.httpErrors.internalServerError('Failed to fetch repository', { cause: error });
    }
  });

  fastify.decorate('fetchDocs', async (request, reply) => {
    try {
      const { repoId } = request.query;
      const userId = request.user.id; // Assuming user is set by verifyToken middleware
      const headerValue = request.headers['x-correlation-id'];
      const correlationId = (
        typeof headerValue === 'string' && headerValue.trim()
      )
    ? headerValue
    : `http-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      fastify.log.info(`Processing fetchDocs HTTP request for user: ${userId}, repo: ${repoId}`);
      
      const gitService = await request.diScope.resolve('gitService');
      if (!gitService) {
        throw new Error('Git service not found in DI container');
      }
      
      const docs = await gitService.fetchDocs(userId, repoId, correlationId);
      
      fastify.log.info(`Docs fetched via HTTP: ${JSON.stringify(docs)}`);
      return docs;
    } catch (error) {
      fastify.log.error('Error fetching docs:', error);
      throw fastify.httpErrors.internalServerError('Failed to fetch docs', { cause: error });
    }
  });

  fastify.decorate('persistRepo', async (request, reply) => {
    try {
      const { owner, repo } = request.params;
      const { branch = 'main', forceUpdate = false, includeHistory = true } = request.body || {};
      const userId = request.user.id;
      const headerValue = request.headers['x-correlation-id'];
      const correlationId = (
        typeof headerValue === 'string' && headerValue.trim()
      )
      ? headerValue
      : `http-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      fastify.log.info(`Processing persistRepo HTTP request for user: ${userId}, owner: ${owner}, repo: ${repo}, branch: ${branch}`);
      
      // Check if diScope exists
      if (!request.diScope) {
        fastify.log.error('diScope not found in request object');
        throw new Error('Dependency injection scope not available');
      }

      fastify.log.info('Attempting to resolve gitService from DI container...');
      const gitService = await request.diScope.resolve('gitService');
      
      if (!gitService) {
        fastify.log.error('Git service not found in DI container');
        throw new Error('Git service not found in DI container');
      }

      fastify.log.info('gitService resolved successfully');

      const repoInGithubFormat = repo.includes('/') ? repo : `${owner}/${repo}`;
      fastify.log.info(`Calling gitService.persistRepo with: userId=${userId}, repo=${repoInGithubFormat}, branch=${branch}, forceUpdate=${forceUpdate}, correlationId=${correlationId}`);
      
      try {
        const result = await gitService.persistRepo(userId, repoInGithubFormat, branch, { forceUpdate, includeHistory, correlationId });
        fastify.log.info(`Repository persisted successfully: ${JSON.stringify(result)}`);
        return result;
      } catch (serviceError) {
        fastify.log.error('Error from gitService.persistRepo:', {
          message: serviceError.message,
          stack: serviceError.stack,
          name: serviceError.name,
          code: serviceError.code,
          status: serviceError.status,
          statusCode: serviceError.statusCode
        });
        throw serviceError;
      }
      
    } catch (error) {
      fastify.log.error('Error in persistRepo controller:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        status: error.status,
        statusCode: error.statusCode,
        cause: error.cause
      });
      throw fastify.httpErrors.internalServerError('Failed to persist repository', { cause: error });
    }
  });
}

module.exports = fp(gitController);

// gitService.js
'use strict';
/* eslint-disable no-unused-vars */

const Repository = require('../../domain/entities/repository');
const IGitService = require('./interfaces/IGitService');
const UserId = require('../../domain/value_objects/userId');
const RepoId = require('../../domain/value_objects/repoId');
const RepoFetchedEvent = require('../../domain/events/repoFetchedEvent');
const RepoPersistedEvent = require('../../domain/events/repoPersistedEvent');
const DocsFetchedEvent = require('../../domain/events/docsFetchedEvent');

class GitService extends IGitService {
  constructor({gitMessagingAdapter, gitAdapter, gitPersistAdapter}) {
    super();
    this.gitMessagingAdapter = gitMessagingAdapter;  
    this.gitAdapter = gitAdapter;
    this.gitPersistAdapter = gitPersistAdapter;  
  }

  async fetchRepo(userIdRaw, repoIdRaw, correlationId) {
    try {
      const userId = new UserId(userIdRaw);
      const repoId = new RepoId(repoIdRaw);
      console.log(`[GitService] Starting fetchRepo: userId=${userId}, repoId=${repoId}`);
      
      // Fetch repo from GitHub
      const repository = new Repository(userId);
      const repo = await repository.fetchRepo(repoId.value, this.gitAdapter);
      console.log(`[GitService] ✅ Repository fetched from GitHub successfully`);
      
      // Publish domain event
      const event = new RepoFetchedEvent({ userId: userId.value, repoId: repoId.value, repo });
      await this.gitMessagingAdapter.publishRepoFetchedEvent(event, correlationId);
      console.log(`[GitService] ✅ Event published to Pub/Sub successfully`);
      
      // Persist to database
      await this.gitPersistAdapter.persistRepo(userId.value, repoId.value, repo);
      console.log(`[GitService] ✅ Repository persisted to database successfully`);
      
      console.log(`[GitService] ✅ fetchRepo completed successfully`);
      return repo;
      
    } catch (error) {
      console.error(`[GitService] ❌ fetchRepo failed:`, {
        message: error.message,
        code: error.code,
        detail: error.detail,
        userId: userIdRaw,
        repoId: repoIdRaw,
        correlationId,
        stack: error.stack
      });
      throw error;
    }
  }

  async fetchDocs(userIdRaw, repoIdRaw, correlationId) {
    try {
      const userId = new UserId(userIdRaw);
      const repoId = new RepoId(repoIdRaw);
      console.log(`[GitService] Starting fetchDocs: userId=${userId}, repoId=${repoId}`);
      
      const repository = new Repository(userId);
      const docsData = await repository.fetchDocs(repoId.value, this.gitAdapter);
      console.log(`[GitService] ✅ Docs fetched from GitHub successfully`);
      
      // Publish domain event
      const event = new DocsFetchedEvent({ userId: userId.value, repoId: repoId.value, docs: docsData });
      await this.gitMessagingAdapter.publishDocsFetchedEvent(event, correlationId);
      console.log(`[GitService] ✅ Docs event published to Pub/Sub successfully`);
      
      // Persist to database
      await this.gitPersistAdapter.persistDocs(userId.value, repoId.value, docsData);
      console.log(`[GitService] ✅ Docs persisted to database successfully`);
      
      console.log(`[GitService] ✅ fetchDocs completed successfully`);
      return docsData;
      
    } catch (error) {
      console.error(`[GitService] ❌ fetchDocs failed:`, {
        message: error.message,
        code: error.code,
        detail: error.detail,
        userId: userIdRaw,
        repoId: repoIdRaw,
        correlationId,
        stack: error.stack
      });
      throw error;
    }
  }

  async persistRepo(userIdRaw, repoIdRaw, branch = 'main', options = {}) {
    try {
      const { forceUpdate = false, includeHistory = true, correlationId } = options;
      const userId = new UserId(userIdRaw);
      const repoId = new RepoId(repoIdRaw);
      console.log(`[GitService] Starting persistRepo: userId=${userId}, repoId=${repoId}, branch=${branch}, forceUpdate=${forceUpdate}`);
      
      // Create repository domain entity
      const repository = new Repository(userId);
      
      // Check if repository already exists (if not forcing update)
      if (!forceUpdate) {
        try {
          const existingRepo = await this.gitPersistAdapter.getRepo(userId.value, repoId.value);
          if (existingRepo) {
            console.log(`[GitService] ⚠️ Repository already exists and forceUpdate=false`);
            throw new Error(`Repository ${repoId.value} already exists for user ${userId.value}. Use forceUpdate=true to overwrite.`);
          }
        } catch (getError) {
          // If error is "not found", continue with persistence
          if (!getError.message.includes('not found') && !getError.message.includes('does not exist')) {
            throw getError;
          }
          console.log(`[GitService] Repository does not exist, proceeding with persistence`);
        }
      }
      
      // Fetch repository data from GitHub
      const repoData = await repository.fetchRepo(repoId.value, this.gitAdapter);
      console.log(`[GitService] ✅ Repository data fetched from GitHub successfully`);
      
      // Persist to database with additional metadata
      const persistResult = await this.gitPersistAdapter.persistRepo(
        userId.value, 
        repoId.value, 
        repoData, 
        { branch, includeHistory, persistedAt: new Date().toISOString() }
      );
      console.log(`[GitService] ✅ Repository persisted to database successfully`);
      
      // Create and publish domain event (you may want to create RepoPersistedEvent)
      const event = new RepoPersistedEvent({ 
        userId: userId.value, 
        repoId: repoId.value, 
        repo: repoData,
        action: 'persist',
        branch,
        forceUpdate,
        persistedAt: new Date().toISOString()
      });
      await this.gitMessagingAdapter.publishRepoPersistedEvent(event, correlationId);
      console.log(`[GitService] ✅ Persistence event published to Pub/Sub successfully`);
      
      const result = {
        success: true,
        repositoryId: repoId.value,
        owner: repoId.value.split('/')[0],
        repo: repoId.value.split('/')[1],
        branch,
        persistedAt: new Date().toISOString(),
        filesProcessed: repoData.files?.length || 0,
        message: forceUpdate ? 'Repository updated successfully' : 'Repository persisted successfully'
      };
      
      console.log(`[GitService] ✅ persistRepo completed successfully`);
      return result;
      
    } catch (error) {
      console.error(`[GitService] ❌ persistRepo failed:`, {
        message: error.message,
        code: error.code,
        detail: error.detail,
        userId: userIdRaw,
        repoId: repoIdRaw,
        branch,
        options,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = GitService;

// repository.js
'use strict';

const UserId = require('../value_objects/userId');
const RepoId = require('../value_objects/repoId');

class Repository {
  constructor(userIdRaw) {
    // Accept already constructed UserId or raw value
    this.userId = userIdRaw instanceof UserId ? userIdRaw : new UserId(userIdRaw);
  }

  async fetchRepo(repoIdRaw, IGitPort) {
    const repoId = new RepoId(repoIdRaw);
    const data = await IGitPort.fetchRepo(this.userId.value, repoId.value);
    console.log(`Repository fetched: ${repoId.value}`);
    return data;
  }

  async fetchDocs(repoIdRaw, IGitPort) {
    const repoId = new RepoId(repoIdRaw);
    const data = await IGitPort.fetchDocs(this.userId.value, repoId.value);
    console.log(`Docs fetched for repository: ${repoId.value}`);
    return data;
  }

  async persistRepo(repoIdRaw, branch, IGitPort, options = {}) {
    const repoId = new RepoId(repoIdRaw);
    const data = await IGitPort.fetchRepo(this.userId.value, repoId.value);
    console.log(`Repository data prepared for persistence: ${repoId.value}, branch: ${branch}`);
    return data;
  }
}

module.exports = Repository;

// RepoFetchedEvent.js
class RepoFetchedEvent {
  constructor({ userId, repoId, repo, occurredAt = new Date() }) {
    this.userId = userId;
    this.repoId = repoId;
    this.repo = repo;
    this.occurredAt = occurredAt;
  }
}
module.exports = RepoFetchedEvent;

// repoPersistedEvent.js
'use strict';

class RepoPersistedEvent {
  constructor({ userId, repoId, repo, branch = 'main', action = 'persist', forceUpdate = false, persistedAt = null }) {
    this.userId = userId;
    this.repoId = repoId;
    this.repo = repo;
    this.branch = branch;
    this.action = action;
    this.forceUpdate = forceUpdate;
    this.persistedAt = persistedAt || new Date().toISOString();
    this.eventType = 'RepoPersistedEvent';
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      eventType: this.eventType,
      userId: this.userId,
      repoId: this.repoId,
      repo: this.repo,
      branch: this.branch,
      action: this.action,
      forceUpdate: this.forceUpdate,
      persistedAt: this.persistedAt,
      timestamp: this.timestamp
    };
  }
}

module.exports = RepoPersistedEvent;

// IGitPersistPort.js
'use strict';
/* eslint-disable no-unused-vars */

class IGitPersistPort {
  constructor() {
    if (new.target === IGitPersistPort) {
      throw new Error('Cannot instantiate an abstract class.');
    }
  }

    async persistRepo(userId, repoId, repo) {    
        throw new Error('Method not implemented.');
    }

    async persistDocs(userId, repoId, docs) {
    throw new Error('Method not implemented.');
    }

    async getRepo(userId, repoId) {
        throw new Error('Method not implemented.');
    }
}

module.exports = IGitPersistPort;

// IGitPort.js
'use strict';
/* eslint-disable no-unused-vars */

class IGitPort {
  constructor() {
    if (new.target === IGitPort) {
      throw new Error('Cannot instantiate an abstract class.');
    }
  }

  // Fetches data for an existing repository.
  async fetchRepo(userId, repoId) {
    throw new Error('Method not implemented.');
  }

  // Fetches data for an existing repository's docs.  
  async fetchDocs(userId, repoId) {
    throw new Error('Method not implemented.');
  }

}
module.exports = IGitPort;

// repoId.js
'use strict';
class RepoId {
  constructor(value) {
    if (!value || typeof value !== 'string') throw new Error('Invalid RepoId');
    this.value = value;
  }
  equals(other) { return other instanceof RepoId && this.value === other.value; }
  toString() { return this.value; }
}
module.exports = RepoId; /* eslint-disable no-console */
/* eslint-disable no-unused-vars */
'use strict';
const { Octokit } = require('@octokit/rest');
const IGitPort = require('../../domain/ports/IGitPort');

class GitGithubAdapter extends IGitPort {
  constructor() {
    super();
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('Missing GITHUB_TOKEN');
    this.octokit = new Octokit({ auth: token });
  }

  async fetchRepo(userId, repoId) {
    console.log(`=== GitGithubAdapter.fetchRepo called ===`);
    console.log(`Parameters: userId=${userId}, repoId=${repoId}`);
    console.log(`Github token present: ${process.env.GITHUB_TOKEN ? 'YES' : 'NO'}`);
    
    const parts = repoId.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid repoId format "${repoId}", expected "owner/repo"`);
    }
    const [owner, repo] = parts;
    console.log(`Parsed owner: ${owner}, repo: ${repo}`);
    
    try {
      console.log('Step 1: Fetching repository metadata...');
      
      // 1. Fetch repository details
      const repoResponse = await this.octokit.rest.repos.get({
        owner,
        repo,
        headers: {
          accept: 'application/vnd.github+json'
        }
      });

      console.log(`Repository response received. Status: ${repoResponse.status}`);
      console.log(`Default branch: ${repoResponse.data.default_branch}`);

      const defaultBranch = repoResponse.data.default_branch;

      console.log('Step 2: Fetching branch details...');

      // 2. Fetch the default branch details
      const branchResponse = await this.octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: defaultBranch,
        headers: {
          accept: 'application/vnd.github+json'
        }
      });

      console.log('Step 3: Fetching repository tree (file structure)...');

      // 3. Fetch the complete file tree
      const treeResponse = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: branchResponse.data.commit.sha,
        recursive: 1 // Get all files recursively
      });

      console.log(`Tree fetched: ${treeResponse.data.tree.length} items found`);

      // 4. Return clean repository data
      const data = {
        repository: repoResponse.data,
        branch: branchResponse.data,
        tree: treeResponse.data,
        fetchedAt: new Date().toISOString(),
        fetchedBy: userId
      };

      console.log('=== GitGithubAdapter.fetchRepo completed successfully ===');
      return data;
    } catch (error) {
      console.error(`=== ERROR in GitGithubAdapter.fetchRepo ===`);
      console.error(`Error type: ${error.constructor.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error status: ${error.status}`);
      console.error(`Error response:`, error.response?.data);
      console.error(`Full error:`, error);
      throw error;
    }
  }



  async fetchDocs(userId, repoId) {
    // Keep your existing docs method unchanged
    const [owner, repo] = repoId.split('/');
    const docsRepo = `${repo}.docs`;
    try {
      const repoResponse = await this.octokit.rest.repos.get({
        owner,
        repo,
        headers: {
          accept: 'application/vnd.github+json'
        }
      });

      const defaultBranch = repoResponse.data.default_branch;

      const response = await this.octokit.rest.repos.downloadZipballArchive({
        owner,
        repo: docsRepo,
        ref: defaultBranch
      });
      console.log(`Docs for '${defaultBranch}' branch downloaded for repository: ${repoId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching docs for repository ${repoId}:`, error.message);
      throw error;
    }
  }


}

module.exports = GitGithubAdapter; // gitPostgresAdapter.js
'use strict';

const { Pool } = require('pg');
const IGitPersistPort = require('../../domain/ports/IGitPersistPort');

const isLocal = process.env.NODE_ENV !== 'staging';

class GitPostgresAdapter extends IGitPersistPort {
  constructor({ cloudSqlConnector }) {
    super();
    this.connector = cloudSqlConnector;
    this.poolPromise = isLocal
      ? this.createLocalPool()
      : this.createCloudSqlPool(cloudSqlConnector);
  }

  async getPool() {
    if (!this.pool) {
      this.pool = await this.poolPromise;
    }
    return this.pool;
  }

  createLocalPool() {
    const config = {
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      host: 'localhost',
      port: 5432,
    };
    return Promise.resolve(new Pool(config));
  }

  async createCloudSqlPool(connector) {
    const instanceConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
    if (!instanceConnectionName) {
      throw new Error('❌ CLOUD_SQL_CONNECTION_NAME env var not set.');
    }

    const clientOpts = await connector.getOptions({
      instanceConnectionName,
      ipType: 'PRIVATE',
      authType: 'ADC',
    });

    const config = {
      ...clientOpts,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
    };

    console.info('[DB] Using Cloud SQL config for:', instanceConnectionName);
    return new Pool(config);
  }

  // ✅ Fixed method name and added git schema
  async persistRepo(userId, repoId, repo) {    
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      console.log(`[DB] Attempting to persist repo: ${repoId} for user: ${userId}`);
      
      const query = `
        INSERT INTO git.repositories (user_id, repo_id, data, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, repo_id) 
        DO UPDATE SET data = $3, updated_at = NOW()
      `;
      
      // Ensure repo is a JSON object
      const jsonData = JSON.stringify(repo);
      console.log(`[DB] Query: ${query}`);
      console.log(`[DB] Parameters: userId=${userId}, repoId=${repoId}, dataLength=${jsonData.length}`);
      
      const result = await client.query(query, [userId, repoId, jsonData]);
      console.log(`[DB] ✅ Repository persisted successfully: ${repoId} for user: ${userId}`);
      console.log(`[DB] Query result:`, result.rowCount, 'rows affected');
      
    } catch (error) {
      console.error(`[DB] ❌ Error persisting repo:`, {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        severity: error.severity,
        userId,
        repoId,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // ✅ Fixed method name and added git schema  
  async persistDocs(userId, repoId, docs) {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      console.log(`[DB] Attempting to persist docs: ${repoId} for user: ${userId}`);
      
      const query = `
        INSERT INTO git.docss (user_id, repo_id, data, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, repo_id)
        DO UPDATE SET data = $3, updated_at = NOW()
      `;
      
      console.log(`[DB] Query: ${query}`);
      console.log(`[DB] Parameters: userId=${userId}, repoId=${repoId}, docsSize=${docs ? docs.length : 'null'}`);
      
      const result = await client.query(query, [userId, repoId, docs]);
      console.log(`[DB] ✅ Docs persisted successfully: ${repoId} for user: ${userId}`);
      console.log(`[DB] Query result:`, result.rowCount, 'rows affected');
      
    } catch (error) {
      console.error(`[DB] ❌ Error persisting docs:`, {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        severity: error.severity,
        userId,
        repoId,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // ✅ Get repository for existence checking (used by persistRepo)
  async getRepo(userId, repoId) {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      console.log(`[DB] Attempting to get repo: ${repoId} for user: ${userId}`);
      
      const query = `
        SELECT user_id, repo_id, data, created_at, updated_at
        FROM git.repositories 
        WHERE user_id = $1 AND repo_id = $2
      `;
      
      console.log(`[DB] Query: ${query}`);
      console.log(`[DB] Parameters: userId=${userId}, repoId=${repoId}`);
      
      const result = await client.query(query, [userId, repoId]);
      
      if (result.rows.length === 0) {
        console.log(`[DB] ℹ️ Repository not found: ${repoId} for user: ${userId}`);
        throw new Error(`Repository ${repoId} does not exist for user ${userId}`);
      }
      
      console.log(`[DB] ✅ Repository found: ${repoId} for user: ${userId}`);
      return result.rows[0];
      
    } catch (error) {
      if (error.message.includes('does not exist')) {
        // Re-throw "not found" errors for service layer handling
        throw error;
      }
      
      console.error(`[DB] ❌ Error getting repo:`, {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        severity: error.severity,
        userId,
        repoId,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = GitPostgresAdapter;

// gitPubsubAdapter.js
'use strict';

class GitPubsubAdapter {
  constructor({ pubSubClient }) {
    this.pubSubClient = pubSubClient;
    this.topicName = process.env.PUBSUB_GIT_EVENTS_TOPIC_NAME || 'git-topic';
  }

  async publishRepoFetchedEvent(result, correlationId) {
    const event = {
      event: 'repositoryFetched',
      correlationId, // Include correlationId directly in the event payload
      ...result
    };
    const dataBuffer = Buffer.from(JSON.stringify(event));
    try {
      // Use the injected client instance to get the topic
      const topic = this.pubSubClient.topic(this.topicName);
      const messageId = await topic.publishMessage({ data: dataBuffer });
      console.log(`Published 'repositoryFetched' event with message ID: ${messageId} to topic: ${this.topicName}`);
      return messageId;
    } catch (error) {
      console.error(`Error publishing 'repositoryFetched' event to topic ${this.topicName}:`, error);
      throw error;
    }
  }

  async publishDocsFetchedEvent(result, correlationId) {
    const event = {
      event: 'docsFetched',
      correlationId, // Include correlationId directly in the event payload
      ...result
    };
    const dataBuffer = Buffer.from(JSON.stringify(event));
    try {
      // Use the injected client instance to get the topic
      const topic = this.pubSubClient.topic(this.topicName);
      const messageId = await topic.publishMessage({ data: dataBuffer });
      console.log(`Published 'docsFetched' event with message ID: ${messageId} to topic: ${this.topicName}`);
      return messageId;
    } catch (error) {
      console.error(`Error publishing 'docsFetched' event to topic ${this.topicName}:`, error);
      throw error;
    }
  }

  async publishRepoPersistedEvent(event, correlationId) {
    // DUAL-PATH ARCHITECTURE:
    // Path 1: GitHubb Actions publishes repoPushed events directly (primary)
    // Path 2: Git API persist endpoint also publishes (fallback for manual triggers)
    // Both use the same payload format for consistency
    
    const [owner, name] = event.repoId.split('/');
    
    // Payload format matches GitHub Actions workflow (deploy.yml)
    // This ensures AI module receives consistent data from both sources
    const eventPayload = {
      event: 'repoPushed',
      eventType: 'repoPushed',
      correlationId,
      userId: event.userId,
      repoId: event.repoId,
      repoData: {
        // CRITICAL: AI module's ContextPipeline validates these fields
        url: `https://github.com/${event.repoId}`,
        branch: event.branch || 'main',
        githubOwner: owner,
        repoName: name,
        // Optional metadata enrichment from GitHub API response
        description: event.repo?.repository?.description,
        defaultBranch: event.repo?.repository?.default_branch,
        language: event.repo?.repository?.language,
        stargazersCount: event.repo?.repository?.stargazers_count,
        forksCount: event.repo?.repository?.forks_count,
        updatedAt: event.repo?.repository?.updated_at,
        source: 'git-module-api'
      },
      timestamp: event.timestamp || new Date().toISOString()
    };
    const dataBuffer = Buffer.from(JSON.stringify(eventPayload));
    try {
      const topic = this.pubSubClient.topic(this.topicName);
      const messageId = await topic.publishMessage({ data: dataBuffer });
      console.log(`✅ Published 'repoPushed' event (from repoPersisted) with message ID: ${messageId} to topic: ${this.topicName}`);
      console.log(`📋 Event payload: userId=${event.userId}, repoId=${event.repoId}, branch=${event.branch}`);
      return messageId;
    } catch (error) {
      console.error(`❌ Error publishing 'repoPushed' event to topic ${this.topicName}:`, error);
      throw error;
    }
  }
}

module.exports = GitPubsubAdapter;