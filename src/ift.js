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
 * @author Servio Palacios
 * IFT - IBM Food Trust Derived Class. IFT = IBM Food Trust
 * @module src/ift/ift
 *
 */
const REST = require("./rest");

class IFT extends REST {
    constructor(param = {}) {
        super(param);
        let self = this;
    } //constructor

    /**
     * add a new certificate in the ledger
     * it converts the prmiusgfs format to IFT format
     * then it send the content to the IFT
     * @param {*} _audit, _certificate
     */
    putCertificate(_audit, _certificate) {
        let self = this;
        console.log("[ADDING] - [CERTIFICATE]");
        if (self._connected) {
            if (!self._onboarding_token_in_header) {
                self._buildCertificatesHeader();
            }

            return self
                .post(
                    self._certificates_path,
                    self._certificates_header,
                    "",
                    self._mapOada2Hyperledger(_audit, _certificate)
                )
                .then(response => {
                    //console.log('newCertificate', response);
                    return Promise.resolve(response.data.certificationId);
                })
                .catch(err => {
                    return Promise.reject(err);
                });
        } else {
            console.log("[Not connected]");
        }
    } //addCertificate

    /**
     * deletes a certificate
     */
    delCertificate(_certificationId) {
        let self = this;
        console.log("[DELETING] - [CERTIFICATE]");
        if (self._connected) {
            if (!self._onboarding_token_in_header) {
                self._buildCertificatesHeader();
            }
            let _path =
                self._certificates_point_query_path +
                self._certificate_id +
                self._certificate_delete_path_leftover;

            self.del(_path, self._certificates_header).then(response => {
                console.log("delCertificates", response);
            });
        } else {
            console.log("[Not connected]");
        }
    } //deleteCertificate

    /**
     * returns the content of the _certificationId stored in the hyperledger
     * @param {*} _certificationId
     */
    getCertificate(_certificationId) {
        let self = this;
        console.log("[FETCHING] - [CERTIFICATE]");
        if (self._connected) {
            if (!self._onboarding_token_in_header) {
                self._buildCertificatesHeader();
            }
            let _path = _certificationId
                ? self._certificates_point_query_path + _certificationId
                : self._certificates_path;
            //console.log("Certificates Header", self._certificates_header);
            self
                .get(_path, self._certificates_header)
                .then(response => {
                    console.log("getCertificates", response);
                    return response.data;
                })
                .catch(err => {
                    console.log("[Error]");
                    return null;
                });
        } else {
            console.log("[Not connected]");
        }
    } //getCertificate

    /**
     *  waits for connection to be established then sends request for a certificate
     **/
    getCertificateManager(_certificationId) {
        let self = this;
        if (!self._connected) {
            setTimeout(
                self.getCertificate(_certificationId).then(response => {
                    console.log(response);
                }),
                100
            );
        } else {
            return self.getCertificate();
        }
    } //getCertificateManager
} //class

/* exporting the module */
module.exports = IFT;
