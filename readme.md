# trellisfw-ift
Trellisfw - IBM Food Trust Javascript API.


## Connecting to the **IBM Food Trust**
```js
const IFT = require("trellisfw-ift");

let _IFT = new IFT({
  organization_id: "",
  apiKey: ""
});

/**
 * connecting to IFT framework
 * retriving a certificate to the IFT
 */
_IFT.connect().then(response => {
  _IFT.getCertificateManager("e623ec02f73ce20428201045b1f68df5");
});

```

## Creating a new Certificate in the **IBM Food Trust (IFT)**:
```js
const IFT = require("trellisfw-ift");

let _IFT = new IFT({
  organization_id: "",
  apiKey: ""
});

_IFT.connect().then(response => {
  _IFT.putCertificate(_audit, _certificate).then(response => {
    console.log(response);
});
```

