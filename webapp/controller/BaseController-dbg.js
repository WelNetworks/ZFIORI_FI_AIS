sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox"
], function (Controller, History, MessageBox) {
    "use strict";

    return Controller.extend("com.wel.assetstandardcost.controller.BaseController", {
        /**
         * Convenience method for accessing the view model by name.
         * @public
         * @param {string} [sName] the model name
         * @returns {sap.ui.model.Model} the model instance
         */
        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

        /**
         * Convenience method for setting the view model.
         * @public
         * @param {sap.ui.model.Model} oModel the model instance
         * @param {string} [sName] the model name
         * @returns {sap.ui.core.mvc.View} the current view instance
         */
        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        /**
         * Getter for the resource bundle.
         * @public
         * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
         */
        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /**
         * Reads data from the backend OData service.
         * @public
         * @param {string} sPath the entity set or path
         * @param {object} [urlParam] URL parameters
         * @param {sap.ui.model.Filter[]} [filters] array of filters
         * @returns {Promise<object>} promise resolving with the read result
         */
        getDataFromServer: function (sPath, urlParam, filters) {
            return new Promise((resolve, reject) => {
                const oDataModel = this.getOwnerComponent().getModel();

                oDataModel.read(sPath, {
                    filters: filters,
                    urlParameters: urlParam,
                    success: (oData) => resolve(oData),
                    error: (err) => reject(err),
                    async: true
                });
            });
        },

        /**
         * Creates an entity on the backend OData service.
         * @public
         * @param {string} sPath the entity set path
         * @param {object} [oEntity={}] the entity payload
         * @returns {Promise<object>} promise resolving with the created entity
         */
        postDataToServer: function (sPath, oEntity = {}) {
            return new Promise((resolve, reject) => {
                const oDataModel = this.getOwnerComponent().getModel();

                oDataModel.create(sPath, oEntity, {
                    success: (oData) => resolve(oData),
                    error: (err) => reject(err),
                    async: true
                });
            });
        },

        /**
         * Updates an entity on the backend OData service.
         * @public
         * @param {string} sPath the entity path
         * @param {object} oEntity the entity payload to update
         * @returns {Promise<object>} promise resolving with the update result
         */
        updateDataToServer: function (sPath, oEntity) {
            return new Promise((resolve, reject) => {
                const oDataModel = this.getOwnerComponent().getModel();

                oDataModel.update(sPath, oEntity, {
                    method: "PUT",
                    success: (oData) => resolve(oData),
                    error: (err) => reject(err),
                    async: true
                });
            });
        },

        /**
         * Deletes an entity on the backend OData service.
         * @public
         * @param {string} sPath the entity path to delete
         * @returns {Promise<object>} promise resolving on successful delete
         */
        deleteDataRequestToServer: function (sPath) {
            return new Promise((resolve, reject) => {
                const oDataModel = this.getOwnerComponent().getModel();

                oDataModel.remove(sPath, {
                    method: "DELETE",
                    success: (oData) => resolve(oData),
                    error: (err) => reject(err),
                    async: true
                });
            });
        },

        /**
         * Displays a popup message dialog based on the provided type.
         * @public
         * @param {"Error"|"Warning"|"Alert"|"Success"} sType the type of message
         * @param {string} sMsg the message to display
         */
        displayMessage: function (sType, sMsg) {
            switch (sType) {
                case "Error":
                    MessageBox.error(sMsg);
                    break;
                case "Warning":
                    MessageBox.warning(sMsg);
                    break;
                case "Alert":
                    MessageBox.alert(sMsg);
                    break;
                case "Success":
                    MessageBox.success(sMsg);
                    break;
                default:
                    break;
            }
        }
    });
});
