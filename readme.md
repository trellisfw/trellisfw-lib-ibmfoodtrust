# trellisfw-ift

Trellisfw - IBM Food Trust Javascript API.

## Connecting to the **IBM Food Trust**

```js
const primusgfs = require("./templates/primusgfs");
const IFT = require("trellisfw-lib-ibmfoodtrust");
const debug = require("debug")("trellisfw-lib-ibmfoodtrust:index");

let ift = new IFT({
  organization_id: "OrganizationIdGoesHere",
  apiKey: "apiKeyGoesHere"
});

/**
 * connecting to IFT framework
 * retriving a certificate to the IFT
 */
return ift
  .getCertificate("certificateid")
  .then(response => {
    debug("[FETCHED]", response);
  })
  .catch(err => {
    debug("Error: Failed to getCertificate() to hyperledger.", err);
  });
```

## Creating a new Certificate in the **IBM Food Trust (IFT)**:

```js
const IFT = require("trellisfw-ift");

const certificationId = someCerticationId;

let ift = new IFT({
  organization_id: "OrganizationIdGoesHere",
  apiKey: "apiKeyGoesHere"
});

return ift
  .putCertificate(audit, certificate)
  .then(hyperledgerId => {
    debug(
      certificationId,
      "Successfully pushed to hyperledger. hyperledger_id:",
      hyperledgerId
    );
  })
  .catch(err => {
    debug(
      certificationId,
      "Error: Failed to putCertificate() to hyperledger.",
      err
    );
  });
```
