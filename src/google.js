/*eslint-env es_modules */
import { google } from 'googleapis';
import querystring from 'querystring';
import url from 'url';
import debug from 'debug';
import * as events from './events';
import * as state from './state';

// Setup debug log
const log = debug('watsonwork-messages-google');

class GoogleClient {
  constructor() {
  	this.oAuth2Client = new google.auth.OAuth2(
      process.env.GAPI_CLIENT_ID,
      process.env.GAPI_CLIENT_SECRET,
      process.env.GAPI_CLIENT_REDIRECT_URI
    );
    this.handleCallback = this.handleCallback.bind(this);
    this.checkToken = this.checkToken.bind(this);
  }

  makeAuthorizeUrl(userId, scopes) {
  	this.authorizeUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes.join(' '),
      state: userId
    });
  }

  handleCallback(store) {
    return (req, res, next) => {
      const qs = querystring.parse(url.parse(req.url).query);
      return this.oAuth2Client.getToken(qs.code).then(body => {
        log('got tokens for %o, body: %o', qs, body);
        // qs.state is the userId from above
        state.run(qs.state, store, (err, ostate, put) => {
          log('updating token, error %o old state %o', err, ostate);
          if (err) {
            // request may have originated from a different user
            res.status(403).end();
            put(err);
            return;
          }
          const newState = Object.assign({}, ostate, { tokens: body.tokens });
          put(null, newState);
          // we were in the middle of an action flow, continue...
        }, next);
        // don't necessarily rely on these credentials, because the oAuth2Client is a singleton.
        // the pouchdb store keeps track of each user's tokens.
        this.oAuth2Client.credentials = body.tokens;
      });
    }
  }

  /**
   * Returns an express middleware function to handle unauthenticated users.
   * @param {PouchDB} store
   * @param {function} reauth - function to call if the user needs to reauth.
   */
  checkToken(appId, store, reauth) {
    return (req, res, next) => {
      const { userId } = req.body;
      // if the user is not authenticated, store what they were trying to do
      // in pouch so they can pick it back up when they finish authenticating.
      const storeAction = () => {
        events.onActionSelected(req.body, appId, (actionId, action) => {
          const args = actionId.split(' ');
          state.put(
            userId,
            {
              actionType: args[0],
              action
            },
            store,
            () => reauth(action, userId)
          );
        });
        res.status(201).end();
      }

      state.get(userId, store, (e, userState) => {
        log('get existing state for user: %o, err: %o', userState, e);
        if (e || !userState.token) {
          storeAction();
          return;
        }
        this.oAuth2Client.getTokenInfo(userState.token)
          .then(next)
          .catch((oauthInfoError) => {
            log('Oauth err %o', oauthInfoError);
            storeAction();
          });
      });
    }
  }
}

export default new GoogleClient();