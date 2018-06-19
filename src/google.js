/*eslint-env es_modules */
import { google } from 'googleapis';
import querystring from 'querystring';
import url from 'url';
import * as state from './state';

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
    return (req, res) => {
      const qs = querystring.parse(url.parse(req.url).query);
      res.end('************************** handling google oauth callback ****************************');
      return this.oAuth2Client.getToken(qs.code).then(body => {
        state.run(qs.state, store, (err, ostate, cb) => {
          log('updating token, error %o old state %o', err, ostate);
          if (err || !ostate.next) {
            // request may have originated from a different user
            cb(err);
            return;
          }
          const newState = { tokens: body.tokens };
          cb(null, newState);
          // we were in the middle of an action flow, continue...
          ostate.next();
        });
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
  checkToken(store, reauth) {
    return (req, res, next) => {
      const { userId, spaceId } = req.body;
      state.get(userId, store, (e, userState) => {
        if (e || !userState.token) {
          state.put(userId, { next }, store, () => reauth(spaceId, userId));
          return;
        }
        this.oAuth2Client.getTokenInfo(userState.token)
          .then(next)
          .catch((oauthInfoError) => {
            log('Oauth err %o', oauthInfoError);
            state.put(userId, { next }, store, () => reauth(spaceId, userId));
          });
      });
    }
  }
}

export default new GoogleClient();