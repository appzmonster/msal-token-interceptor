import { BaseInterceptor } from "@appzmonster/fetch-interceptor";
import { PublicClientApplication } from "@azure/msal-browser";

class MsalTokenHandler extends BaseInterceptor
{
    constructor(tokenRequest, msalInstance, setAccount)
    {
        super();

        this._msalInstance = msalInstance;
        this._tokenRequest = tokenRequest;
        this._setAccount = setAccount;

        let defaultValue = MsalTokenHandler.getDefault();
        if (defaultValue != null)
        {
            this._defaultMsalInstance = defaultValue.msalInstance;
            this._defaultTokenRequest = defaultValue.tokenRequest;
        }

        this._token = null;
    }

    async invoke(resource, init)
    {
        // Reset the token before invoking a new token request.
        this._token = null;

        // Exchange token with auth server.
        this._token = await this._acquireToken();
        
        if ((this._token != null) &&
            (this._token.accessToken != null))
        {
            var authorizationHeader = { 
                Authorization: `Bearer ${this._token.accessToken}`,
            };

            init.headers = Object.assign({}, init.headers, authorizationHeader);
        }
        else
        {
            throw new Error("Unable to exchange a valid token with authorization server");
        }

        return await super.fetch(resource, init);
    }

    async token()
    {
        return this._token;
    }

    _getMsalInstance()
    {
        let msalInstance = null;

        if (this._msalInstance != null)
        {
            msalInstance = this._msalInstance;
        }
        else
        {
            msalInstance = this._defaultMsalInstance;
        }

        if (msalInstance == null)
        {
            throw new Error('MSAL instance is missing from both default registration and current request');
        }

        return msalInstance;
    }

    async _acquireToken()
    {
        let request = Object.assign({}, this._tokenRequest);
        let token = null;

        if (request.account == null)
        {
            request.account = this._getUserAccount();
        }

        // Use registered default redirect uri (if any) if request does not set 
        // redirect uri. If no redirect uri is set at the request level, it will 
        // fallback using the redirect uri configured at msal instance level.
        if (('redirectUri' in request) === false)
        {
            if ((typeof (this._defaultTokenRequest) === 'object') &&
                (typeof (this._defaultTokenRequest.redirectUri) === 'string'))
            {
                request.redirectUri = this._defaultTokenRequest.redirectUri;
            }
        }

        // If token is not found in the local cache or near expiration, msal will 
        // attempt to exchange a new token with the authorization server using a 
        // hidden iframe. Msal will cache the response token in local cache. Such 
        // flow is call silent authentication and is achieved via the authorization 
        // endpoint with 'prompt' query string set as 'none'.

        console.log("request", request);

        token = await this._getMsalInstance().acquireTokenSilent(request);
        if (token == null)
        {
            throw new Error("Unable to exchange a valid token with authorization server");
        }

        return token;
    }

    _getUserAccount()
    {
        let userAccount = null;

        const userAccounts = this._getMsalInstance().getAllAccounts();

        if (this._setAccount != null)
        {
            userAccount = this._setAccount(userAccounts);
        }
        else
        {
            if ((userAccounts != null) &&
                (userAccounts instanceof Array) &&
                (userAccounts.length > 0))
            {
                userAccount = userAccounts[0];
            }
        }

        return userAccount;
    }
}

MsalTokenHandler.registerDefault = function (defaultMsalInstance, defaultTokenRequest)
{
    if (('fetch' in window) === false)
    {
        return;
    }

    if ((('with' in window.fetch) === false) ||
        (typeof (window.fetch.with) !== 'function'))
    {
        console.error('Unable to register default MSAL token handler interceptor because @appzmonster/fetch-interceptor dependency is not found');
        return;
    }

    let fetchManager = window.fetch.with;
    fetchManager._defaultMsalTokenHandler = {
        msalInstance: defaultMsalInstance,
        tokenRequest: defaultTokenRequest
    };
};

MsalTokenHandler.getDefault = function ()
{
    let defaultValue = null;

    if (('fetch' in window) &&
        ('with' in window.fetch) &&
        (typeof (window.fetch.with._defaultMsalTokenHandler) === 'object'))
    {
        defaultValue = window.fetch.with._defaultMsalTokenHandler;
    }

    return defaultValue;
};

export { MsalTokenHandler };