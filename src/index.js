const primusgfs = require("./templates/primusgfs");

const IFT = require("./ift");

let _IFT = new IFT({
  organization_id: "",
  apiKey: ""
});

/**
 * connecting to IFT framework
 * adding a new certificate to the IFT
 */
_IFT.connect().then(response => {
  _IFT.putCertificate(primusgfs, primusgfs).then(response => {
    console.log(response);
  });
});
