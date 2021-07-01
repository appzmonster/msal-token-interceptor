# Msal-Token-Interceptor

Msal-Token-Interceptor is a request interceptor which uses [Microsoft MSAL](https://www.npmjs.com/package/@azure/msal-browser) to handle OAuth 2.0 token exchange with Microsoft Identity Platform during a [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) request. This is part of [fetch-interceptor](https://www.npmjs.com/package/@appzmonster/fetch-interceptor) family.

Example syntax:
```
fetch
    .with(new MsalTokenHandler({ scopes: [ 'User.Read' ]}))
    (
        "https://graph.microsoft.com/v1.0/me", {
        method: 'GET'
    });
```

## Prerequisites
- Requires [fetch-interceptor](https://www.npmjs.com/package/@appzmonster/fetch-interceptor) and [MSAL](https://www.npmjs.com/package/@azure/msal-browser) and knowledge how to use the 2 libraries.
- Knowledge on [OAuth 2.0](https://oauth.net/2/), [Bearer Token](https://oauth.net/2/bearer-tokens/#:~:text=Bearer%20Tokens%20are%20the%20predominant,such%20as%20JSON%20Web%20Tokens.) and [OpenId Connect](https://openid.net/connect/).
- Knowledge on [Microsoft Identity Platform, Authorization Code Grant](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow).

> NOTE: Authentication is a difficult subject and this README does not cover prerequisite authentication subject such as OpenId Connect, OAuth 2.0 and Microsoft Identity Platform. You need to understand these subjects before able to make correct use of both MSAL and this library. The assumption is that if you're looking for bearer token helper using MSAL when making a fetch request, chances are you should already have knowledge of the mentioned subjects. Otherwise, please read and understand the mentioned subjects before continue. You may have difficulty to follow through if you do not understand those subjects.

> NOTE: MSAL library has a specific version for [React](https://www.npmjs.com/package/@azure/msal-react) (mainly to expose MSAL functions into React component via React Hooks). This library does not require the MSAL React version but uses the standard [Browser](https://www.npmjs.com/package/@azure/msal-browser) version. Therefore, this library can be used in any JavaScript application (e.g. React, Angular...etc.).

## Installation
Msal-Token-Interceptor is available as NPM package.

```
npm install @appzmonster/msal-token-interceptor
```


## Usage
Typically in a MSAL enabled application, you have the following in your **.src/index.js** or at the entry point of the application to initialize your MSAL instance.

```
// Msal package.
import { PublicClientApplication } from '@azure/msal-browser';
import msalConfiguration from './configuration';

...

const msalInstance = new PublicClientApplication(msalConfiguration);
```

> NOTE: You can refer to MSAL initialization [here](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/initialization.md).

Once the MSAL instance is initialized, you can use it to login, logout and acquire token to send authenticated request to the token protected backend service API.

For such an application, there's always a repetitive logic which you need to code, that is to prepare a token before making a service request to the backend service API. Reason being, the backend service API will reject request without a valid token. The token itself sometimes is stored in a local cache and can expire. If it is expired or near expire, you're responsible to talk to the server for a new token. MSAL did a good job providing many handy functions for most tasks except it does not provide you a request interceptor to automatically handle token exchange during an in-flight (outgoing) request. Reason why Microsoft omits this is understandable because you as the developer have many choices to select for your XHR request. The 2 most popular choices are Axios and Fetch API. 

This MSAL token interceptor uses the fetch-interceptor library which uses the Fetch API for the XHR.

The following example shows how you can easily make a Fetch request with all token handling logic taken care for you:

```
// Msal package.
import { PublicClientApplication } from '@azure/msal-browser';
import msalConfiguration from './configuration';

// Fetch-interceptor package
import { initialize } from '@appzmonster/fetch-interceptor';
initialize(); // Enable fetch interceptor support on Fetch API.

...

const msalInstance = new PublicClientApplication(msalConfiguration);

let response = await fetch
    .with(new MsalTokenHandler({ scopes: [ 'User.Read' ]}, msalInstance))
    (
        "https://graph.microsoft.com/v1.0/me", {
        method: 'GET'
    });
```

### `MsalTokenHandler` arguments
The `MsalTokenHandler` has the following arguments:
1. `tokenRequest` (Required)

    A token request type which MSAL uses for the `acquireTokenSilent` function. Refer [here](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/token-lifetimes.md) for information about `acquireTokenSilent`.

2. `msalInstance` (Optional if fallback default MSAL is registered)

    Pass a MSAL instance which you want the request interceptor to use. This is typically the MSAL instance which you initialized at the beginning of the application (an instance of MSAL `PublicClientApplication`).

    > NOTE: You can omit this argument for every fetch request if you registered a default fallback MSAL instance for all MSAL token interceptors in the fetch requests. We will talk about default fallback MSAL later below.
    
3. `setAccount` (Optional)

    This function is invoked when the MSAL instance inside the `MsalTokenHandler` is setting the account for the OAuth 2.0 token request. A token request requires the caller account information in order to verify its identity. An array of user accounts will be passed to this `setAccount` function and expects the function to select one and return. If this argument is omitted, MSAL token interceptor will always use the first user account. 

### Silent Redirect Uri for Token Exchange
In some cases, the application may have a different redirect uri for silent request (silent request is made via an hidden iframe). Getting a token for service API is one such silent request. According to OAuth 2.0 standard, it is recommended for the application to have an empty landing page for silent request to redirect to. Let's assume we do the same in our application:

> NOTE: Both redirect uri and silent redirect uri must be registered in your application authentication uri.

> NOTE: The following is an example written using React:

**./src/index.js**
```
import React from 'react';
import ReactDOM from 'react-dom';
import { PublicClientApplication } from '@azure/msal-browser';
import msalConfiguration from './configuration';
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import './index.css';
import App from './App';

...

const silentRedirectUri = "https://localhost:3000/oidc/response-silent";
const msalInstance = new PublicClientApplication(msalConfiguration);
const silentRedirectRoutePath = new URL(silentRedirectUri).pathname;

ReactDOM.render(
    <React.StrictMode>
        <MsalProvider instance={msalInstance}>
            <Router>
                <Switch>
                    {/* Empty page for iframe silent authentication */}
                    <Route path={silentRedirectRoutePath} render={() => null} />

                    {/* Render actual app */}
                    <Route render={() => <App />}/>
                </Switch>
            </Router>
        </MsalProvider>
    </React.StrictMode>,
  document.getElementById('root')
);
```

You can do the following to set the `redirecrUri` in the  `MSALTokenHandler` of a fetch request:

```
...

let response = await fetch
    .with(new MsalTokenHandler({ 
        scopes: [ 'User.Read' ], redirectUri: silentRedirectUri
    }, msalInstance))
    (
        "https://graph.microsoft.com/v1.0/me", {
        method: 'GET'
    });
```

### Retrieve Last Sent Token from `MsalTokenHandler`
If for some reason the application needs to retrieve the last sent token for the fetch request, you can create a reference to the `MsalTokenHandler` and invoke the `token` function to get the last sent token after the fetch request returns.

```
...

let msalTokenHandler = new MsalTokenHandler({ 
        scopes: [ 'User.Read' ], 
        redirectUri: silentRedirectUri
    }, msalInstance);

let response = await fetch
    .with(msalTokenHandler)
    (
        "https://graph.microsoft.com/v1.0/me", {
        method: 'GET'
    });

if (response.ok)
{
    console.log("last sent token", msalTokenHandler.token());
}

```

### Error handling
If the current session is no longer valid or token can no longer be renewed, MSAL will throw error such as `InteractionRequiredAuthError` requesting the user to re-login. There are many other types of error and you can refer [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-error-handling-js) for information.

`MsalTokenHandler` ***does not suppress the error or attempt to redirect the user to login*** should any of these errors occur during the token exchange. Instead, it will return the error to the caller or to the previous request interceptor for decision. This design is intentional so to allow the developer to have charge to decide what to do with the error. `MsalTokenHandler` does not take an opinionated approach to handle the error on behalf of the developer.

### Register Default `MsalTokenHandler`
In most cases, all fetch requests will be using the same instance of MSAL (the MSAL instance initialized in index.js) to exchange token with auth server. Also, configuration such as silent redirect uri for silent token request is usually the same for all fetch requests (can't think of a reason why you need more than 1 silent redirect uri). With such use case, the `MsalTokenHandler` has a static function to allow registration of a default Msal instance and a default set of token request.

First, import the `MsalTokenHandler` as per normal, typically in **index.js**.

**./src/index.js**
```
import { MsalTokenHandler } from '@appzmonster/msal-token-interceptor';
```

Next, after the MSAL instance is initialized and other token request configuration is ready, register these configuration to `MsalTokenHandler` via the `registerDefault` static function:

**./src/index.js**
```
import { MsalTokenHandler } from '@appzmonster/msal-token-interceptor';

// Initialize msal.
const { msal, ...extensions } = configuration;
const silentRedirectRoutePath = new URL(extensions.silentRedirectUri).pathname;
const msalInstance = new PublicClientApplication(msal);

...

// Register MsalTokenHandler default fallback.
MsalTokenHandler.registerDefault(msalInstance, {
    redirectUri: extensions.silentRedirectUri
});

```

`MsalTokenHandler.registerDefault` arguments:
1. `defaultMsalInstance`

    An instance of MSAL `PublicClientApplication`. If the `msalInstance` argument of a `MsalTokenHandler` in a fetch request is not set, it will fallback using this `defaultMsalInstance`.

2. `defaultTokenRequest`

    A token request type which MSAL uses for the `acquireTokenSilent` function.
    > NOTE: The library only process `redirectUri` for fallback for now. Property such as `scopes` fallback is ignored. I've not thought of an use case where default `scopes` are needed since every request requires different scopes.

Without fallback, you have write the following:
```
...

// Inject values.
const { msal } = useMsal();
const msalInstance = msal.instance;
const { silentRedirectUri } = useSilentRedirectUri();

// Fetch request.
let response = await fetch
    .with(new MsalTokenHandler({ 
        scopes: [ 'User.Read' ], redirectUri: silentRedirectUri
    }, msalInstance))
    (
        "https://graph.microsoft.com/v1.0/me", {
        method: 'GET'
    });
```

With fallback, you write the following: 
```
// No more injection required.
let response = await fetch
    .with(new MsalTokenHandler({ scopes: [ 'User.Read' ]}))
    (
        "https://graph.microsoft.com/v1.0/me", {
        method: 'GET'
    });
```


## Additional notes
Remember to invoke the `initialize` function of [fetch-interceptr](https://www.npmjs.com/package/@appzmonster/fetch-interceptor) before using the `MsalTokenHandler`. `MsalTokenHandler` will outputs an error to the console if request interceptor feature is not enabled.

```
// Fetch-interceptor package
import { initialize } from '@appzmonster/fetch-interceptor';
initialize(); // Enable fetch interceptor support on Fetch API.

...

let response = await fetch
    .with(new MsalTokenHandler({ scopes: [ 'User.Read' ]}))
    (
        "https://graph.microsoft.com/v1.0/me", {
        method: 'GET'
    });
```


## License
Copyright (c) 2021 Jimmy Leong (Github: appzmonster). Licensed under the MIT License.