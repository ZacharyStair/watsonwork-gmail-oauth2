/*eslint-env es_modules */
import { google } from 'googleapis';
import querystring from 'querystring';
import url from 'url';

class GoogleClient {
  constructor() {
  	this.oAuth2Client = new google.auth.OAuth2(
      process.env.GAPI_CLIENT_ID,
      process.env.GAPI_CLIENT_SECRET,
      process.env.GAPI_CLIENT_REDIRECT_URI
    );
    this.handleCallback = this.handleCallback.bind(this);
  }

  makeAuthorizeUrl(scopes) {
  	this.authorizeUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes.join(' ')
    });
  }

  handleCallback(req, res) {
    const qs = querystring.parse(url.parse(req.url).query);
    res.end('************************** handling google oauth callback ****************************');
    return this.oAuth2Client.getToken(qs.code).then(body => {
      this.oAuth2Client.credentials = body.tokens;
    });
  }
}

export default new GoogleClient();