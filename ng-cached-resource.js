(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Generated by CoffeeScript 1.7.1
var app;

app = angular.module('ngCachedResource', ['ngResource']);

app.factory('$cachedResource', [
  '$resource', '$timeout', '$q', function($resource, $timeout, $q) {
    var CACHE_RETRY_TIMEOUT, CachedResourceManager, LOCAL_STORAGE_PREFIX, ResourceCacheEntry, ResourceWriteQueue, cache, defaultActions, readCache, writeCache;
    LOCAL_STORAGE_PREFIX = 'cachedResource://';
    CACHE_RETRY_TIMEOUT = 60000;
    cache = window.localStorage != null ? {
      getItem: function(key, fallback) {
        var item;
        item = localStorage.getItem("" + LOCAL_STORAGE_PREFIX + key);
        if (item != null) {
          return angular.fromJson(item);
        } else {
          return fallback;
        }
      },
      setItem: function(key, value) {
        localStorage.setItem("" + LOCAL_STORAGE_PREFIX + key, angular.toJson(value));
        return value;
      }
    } : {
      getItem: function(key, fallback) {
        return fallback;
      },
      setItem: function(key, value) {
        return value;
      }
    };
    ResourceCacheEntry = (function() {
      function ResourceCacheEntry(resourceKey, params) {
        var param, paramKeys, _ref;
        this.key = resourceKey;
        paramKeys = Object.keys(params).sort();
        if (paramKeys.length) {
          this.key += '?' + ((function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = paramKeys.length; _i < _len; _i++) {
              param = paramKeys[_i];
              _results.push("" + param + "=" + params[param]);
            }
            return _results;
          })()).join('&');
        }
        _ref = cache.getItem(this.key, {}), this.value = _ref.value, this.dirty = _ref.dirty;
      }

      ResourceCacheEntry.prototype.set = function(value) {
        this.value = value;
        this.dirty = true;
        return this._update();
      };

      ResourceCacheEntry.prototype.clean = function() {
        this.dirty = false;
        return this._update();
      };

      ResourceCacheEntry.prototype._update = function() {
        return cache.setItem(this.key, {
          value: this.value,
          dirty: this.dirty
        });
      };

      return ResourceCacheEntry;

    })();
    ResourceWriteQueue = (function() {
      function ResourceWriteQueue(CachedResource) {
        this.CachedResource = CachedResource;
        this.key = "" + this.CachedResource.$key + "/write";
        this.queue = cache.getItem(this.key, []);
      }

      ResourceWriteQueue.prototype.enqueue = function(params, action, deferred) {
        var entry;
        entry = this.findEntry({
          params: params,
          action: action
        });
        if (entry == null) {
          this.queue.push({
            params: params,
            action: action,
            deferred: deferred
          });
          return this._update();
        } else {
          entry.deferred.$promise.then(function(response) {
            return deferred.resolve(response);
          });
          return entry.deferred.$promise["catch"](function(error) {
            return deferred.reject(error);
          });
        }
      };

      ResourceWriteQueue.prototype.findEntry = function(_arg) {
        var action, entry, params, _i, _len, _ref;
        action = _arg.action, params = _arg.params;
        _ref = this.queue;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          entry = _ref[_i];
          if (action === entry.action && angular.equals(params, entry.params)) {
            return entry;
          }
        }
      };

      ResourceWriteQueue.prototype.removeEntry = function(_arg) {
        var action, entry, newQueue, params, _i, _len, _ref;
        action = _arg.action, params = _arg.params;
        newQueue = [];
        _ref = this.queue;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          entry = _ref[_i];
          if (!(action === entry.action && angular.equals(params, entry.params))) {
            newQueue.push(entry);
          }
        }
        this.queue = newQueue;
        if (this.queue.length === 0 && this.timeout) {
          $timeout.cancel(this.timeout);
          delete this.timeout;
        }
        return this._update();
      };

      ResourceWriteQueue.prototype.flush = function() {
        var cacheEntry, entry, onSuccess, _i, _len, _ref, _results;
        this._setFlushTimeout();
        _ref = this.queue;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          entry = _ref[_i];
          cacheEntry = new ResourceCacheEntry(this.CachedResource.$key, entry.params);
          onSuccess = (function(_this) {
            return function(value) {
              _this.removeEntry(entry);
              return entry.deferred.resolve(value);
            };
          })(this);
          _results.push(this.CachedResource.$resource[entry.action](entry.params, cacheEntry.value, onSuccess, entry.deferred.reject));
        }
        return _results;
      };

      ResourceWriteQueue.prototype._setFlushTimeout = function() {
        if (this.queue.length > 0 && !this.timeout) {
          this.timeout = $timeout(angular.bind(this, this.flush), CACHE_RETRY_TIMEOUT);
          return this.timeout.then((function(_this) {
            return function() {
              if (_this.queue.length !== 0) {
                return _this._setFlushTimeout;
              }
            };
          })(this));
        }
      };

      ResourceWriteQueue.prototype._update = function() {
        var savableQueue;
        savableQueue = this.queue.map(function(entry) {
          return {
            params: entry.params,
            action: entry.actions
          };
        });
        return cache.setItem(this.key, savableQueue);
      };

      return ResourceWriteQueue;

    })();
    CachedResourceManager = {
      queuesByKey: {},
      add: function(CachedResource) {
        return this.queuesByKey[CachedResource.$key] = new ResourceWriteQueue(CachedResource);
      },
      getQueue: function(CachedResource) {
        return this.queuesByKey[CachedResource.$key];
      },
      flushQueues: function() {
        var key, queue, _ref, _results;
        _ref = this.queuesByKey;
        _results = [];
        for (key in _ref) {
          queue = _ref[key];
          _results.push(queue.flush());
        }
        return _results;
      }
    };
    addEventListener('online', function(event) {
      return CachedResourceManager.flushQueues();
    });
    readCache = function(action, resourceKey) {
      return function(parameters) {
        var cacheEntry, deferred, item, resource, _i, _len, _ref;
        resource = action.apply(null, arguments);
        resource.$httpPromise = resource.$promise;
        if (angular.isFunction(parameters)) {
          parameters = null;
        }
        cacheEntry = new ResourceCacheEntry(resourceKey, parameters);
        resource.$httpPromise.then(function(response) {
          return cacheEntry.set(response);
        });
        if (cacheEntry.value) {
          if (angular.isArray(cacheEntry.value)) {
            _ref = cacheEntry.value;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              item = _ref[_i];
              resource.push(item);
            }
          } else {
            angular.extend(resource, cacheEntry.value);
          }
          deferred = $q.defer();
          resource.$promise = deferred.promise;
          deferred.resolve(resource);
        }
        return resource;
      };
    };
    writeCache = function(action, CachedResource) {
      return function() {
        var args, cacheEntry, deferred, error, params, postData, queue, queueDeferred, resource, success;
        args = Array.prototype.slice.call(arguments);
        params = angular.isObject(args[1]) ? args.shift() : {};
        postData = args[0], success = args[1], error = args[2];
        resource = this || {};
        resource.$resolved = false;
        deferred = $q.defer();
        resource.$promise = deferred.promise;
        if (angular.isFunction(success)) {
          deferred.promise.then(success);
        }
        if (angular.isFunction(error)) {
          deferred.promise["catch"](error);
        }
        cacheEntry = new ResourceCacheEntry(CachedResource.$key, params);
        if (!angular.equals(cacheEntry.data, postData)) {
          cacheEntry.set(postData);
        }
        queueDeferred = $q.defer();
        queueDeferred.promise.then(function(value) {
          angular.extend(resource, value);
          resource.$resolved = true;
          return deferred.resolve(resource);
        });
        queueDeferred.promise["catch"](deferred.reject);
        queue = CachedResourceManager.getQueue(CachedResource);
        queue.enqueue(params, action, queueDeferred);
        queue.flush();
        return resource;
      };
    };
    defaultActions = {
      get: {
        method: 'GET'
      },
      query: {
        method: 'GET',
        isArray: true
      },
      save: {
        method: 'POST'
      },
      remove: {
        method: 'DELETE'
      },
      "delete": {
        method: 'DELETE'
      }
    };
    return function() {
      var $key, CachedResource, Resource, action, actions, arg, args, name, paramDefaults, params, url, _ref;
      args = Array.prototype.slice.call(arguments);
      $key = args.shift();
      url = args.shift();
      while (args.length) {
        arg = args.pop();
        if (angular.isObject(arg[Object.keys(arg)[0]])) {
          actions = arg;
        } else {
          paramDefaults = arg;
        }
      }
      if (actions == null) {
        actions = defaultActions;
      }
      if (paramDefaults == null) {
        paramDefaults = {};
      }
      Resource = $resource.call(null, url, paramDefaults, actions);
      CachedResource = {
        $resource: Resource,
        $key: $key
      };
      for (name in actions) {
        params = actions[name];
        action = angular.bind(Resource, Resource[name]);
        if (params.method === 'GET') {
          CachedResource[name] = readCache(action, $key);
        } else if ((_ref = params.method) === 'POST' || _ref === 'PUT' || _ref === 'DELETE') {
          CachedResource[name] = writeCache(name, CachedResource);
        } else {
          CachedResource[name] = action;
        }
      }
      CachedResourceManager.add(CachedResource);
      CachedResourceManager.flushQueues();
      return CachedResource;
    };
  }
]);

app;

},{}]},{},[1])