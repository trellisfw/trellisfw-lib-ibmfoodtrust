"use strict";

/* Copyright 2018 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Servio Palacios, Cyrus, Sam
 * IFT - IBM Food Trust Derived Class. IFT = IBM Food Trust
 * @module src/ift/ift
 *
 */
const REST = require("./rest");
const debug = require("debug")("trellisfw-lib-ibmfoodtrust:ift");

class IFT extends REST {
  constructor(param = {}) {
    super(param);
  } //constructor

  /**
   * add a new certificate in the ledger
   * it converts the prmiusgfs format to IFT format
   * then it send the content to the IFT
   * @param {*} _audit, _certificate
   */
  putCertificate(_audit, _certificate) {
    let self = this;
    debug("[ADDING] - [CERTIFICATE]");
    //Connect if not connected already
    return self.connect().then(() => {
      //Try to send the certificate
      return self
        .post(
          self._certificates_path,
          self._certificates_header,
          "",
          self._mapOada2Hyperledger(_audit, _certificate)
        )
        .then(response => {
          return response.data.certificationId;
        });
    });
  } //addCertificate

  /**
   * deletes a certificate
   */
  delCertificate(_certificationId) {
    let self = this;
    debug("[DELETING] - [CERTIFICATE]");
    return self.connect().then(() => {
      let _path =
        self._certificates_point_query_path +
        self._certificate_id +
        self._certificate_delete_path_leftover;
      return self.del(_path, self._certificates_header).then(response => {
        return response.data;
      });
    });
  } //delCertificate

  /**
   * returns the content of the _certificationId stored in the hyperledger
   * @param {*} _certificationId
   */
  async getCertificate(_certificationId) {
    let self = this;
    debug("[FETCHING] - [CERTIFICATE]");
    return self.connect().then(() => {
      let _path = _certificationId
        ? self._certificates_point_query_path + _certificationId
        : self._certificates_path;
      return self.get(_path, self._certificates_header).then(response => {
        return response.data;
      });
    });
  } //getCertificate
} //class

/* exporting the module */
module.exports = IFT;
