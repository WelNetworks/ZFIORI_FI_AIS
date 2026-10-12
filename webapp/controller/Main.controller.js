sap.ui.define([
    "./BaseController",
    "com/wel/assetstandardcost/model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    BaseController,
    formatter,
    Filter,
    FilterOperator,
    BusyDialog,
    JSONModel,
    Fragment,
    MessageBox,
    MessageToast
) {
    "use strict";

    return BaseController.extend("com.wel.assetstandardcost.controller.Main", {
        formatter: formatter,

        /**
         * Lifecycle hook called when the view is initialized.
         */
        onInit: function () {
            this._busyDialog = new BusyDialog();
            this._service = {
                rowItemsToPost: [],
                canContinueFlag: true
            };
            this._getTableDataFromServer();
            this._createParentModel();
        },

        /**
         * Initializes and sets the 'parentModel' to control view state (e.g. editability).
         * @private
         */
        _createParentModel: function () {
            const oInitialData = { isFieldEditable: false };
            const oParentModel = new JSONModel(oInitialData);
            this.setModel(oParentModel, "parentModel");
        },

        /**
         * Lifecycle hook called after rendering.
         */
        onAfterRendering: function () {},

        /**
         * Initializes and sets the model for creating a new AIS item.
         * @private
         */
        _createNewAWLCostModel: function () {
            const oInitialData = {
                SubClass: "",
                SubClassDesc: "",
                AssetClass: "",
                SubClassValueState: "None"
            };
            const oNewAISModel = new JSONModel(oInitialData);
            this.setModel(oNewAISModel, "newAISJsonModel");
        },

        /**
         * Fetches table data from the server with a busy indicator.
         * @private
         */
        _getTableDataFromServer: async function () {
            const sPath = "/AISSet";
            this._busyDialog.open();
            try {
                await this._getData(sPath, []);
            } catch (oError) {
                // error handled in _getData or network layer
            } finally {
                this._busyDialog.close();
            }
        },

        /**
         * Event handler for searching table rows by SubClass, SubClassDesc, or AssetClass.
         * @param {sap.ui.base.Event} oEvent search field event
         */
        onTableSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oBinding = this.byId("id_awl_cost_table").getBinding("rows");
            let aFilters = [];

            if (sQuery) {
                aFilters = new Filter(
                    [
                        new Filter("SubClass", FilterOperator.EQ, sQuery),
                        new Filter("SubClassDesc", FilterOperator.Contains, sQuery),
                        new Filter("AssetClass", FilterOperator.Contains, sQuery)
                    ],
                    false
                );
            }
            oBinding.filter(aFilters, "Application");
        },

        /**
         * Fetches data from backend and binds to the JSON model with formatted decimals.
         * @private
         * @param {string} sPath OData entity set path
         * @param {sap.ui.model.Filter[]} aFilters filters array
         */
        _getData: async function (sPath, aFilters) {
            const oData = await this.getDataFromServer(sPath, {}, aFilters);
            this._service.canContinueFlag = true;

            if (oData && oData.results) {
                oData.results.forEach((oItem) => {
                    oItem.StdCost = parseFloat(oItem.StdCost).toFixed(2);
                    oItem.StdLife = parseFloat(oItem.StdLife).toFixed(2);
                    oItem.Z11kv = parseFloat(oItem.Z11kv).toFixed(2);
                    oItem.Z33kv = parseFloat(oItem.Z33kv).toFixed(2);
                    oItem.Zlv = parseFloat(oItem.Zlv).toFixed(2);
                });

                const oModel = new JSONModel({ results: oData.results });
                this.setModel(oModel, "oJsonAISSetModel");
            }
        },

        /**
         * Event handler for the delete row button press.
         * Prompts save confirmation if changes are pending before deleting.
         * @param {sap.ui.base.Event} oEvent button press event
         */
        onDeleteRowButtonPress: async function (oEvent) {
            const oTable = oEvent.getSource().getParent().getParent();
            const aSelectedIndices = oTable.getSelectedIndices();
            const oResourceBundle = this.getResourceBundle();

            if (this._service.canContinueFlag) {
                this._handleRowDelete(aSelectedIndices, oTable);
            } else {
                const sConfirmMsg = oResourceBundle.getText("MainController.saveConfirmMessage");
                this._showConfirmationMessage(sConfirmMsg).then((sAction) => {
                    if (sAction === "YES") {
                        this.createPostRequest();
                    } else {
                        this._service.canContinueFlag = true;
                        this._handleRowDelete(aSelectedIndices, oTable);
                    }
                });
            }
        },

        /**
         * Validates row selection and prompts confirmation before deleting selected rows.
         * @private
         * @param {number[]} aIndices selected row indices
         * @param {sap.ui.table.Table} oTable the table control
         */
        _handleRowDelete: function (aIndices, oTable) {
            const oResourceBundle = this.getResourceBundle();

            if (!aIndices.length) {
                this.displayMessage("Error", oResourceBundle.getText("MainController.NoRowsSelected"));
            } else {
                const sConfirmMsg = oResourceBundle.getText("MainController.deleteConfirm");
                MessageBox.warning(sConfirmMsg, {
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: (sAction) => {
                        if (sAction === "YES") {
                            this._deleteRows(aIndices, oTable);
                        }
                    }
                });
            }
        },

        /**
         * Deletes selected rows from backend and updates local model.
         * @private
         * @param {number[]} aIndices selected row indices
         * @param {sap.ui.table.Table} oTable the table control
         */
        _deleteRows: async function (aIndices, oTable) {
            const oModel = this.getModel("oJsonAISSetModel");
            const aResults = oModel ? oModel.getProperty("/results") : [];
            const oResourceBundle = this.getResourceBundle();

            const aRemainingRows = aResults.filter((_, iIndex) => !aIndices.includes(iIndex));
            const aRowsToDelete = aResults.filter((_, iIndex) => aIndices.includes(iIndex));

            const oBusyDialog = new BusyDialog({ title: "DELETING..." });
            oBusyDialog.open();

            const sSuccessMsg = aRowsToDelete.length > 1
                ? oResourceBundle.getText("MainController.SuccessDeleteMessageMultiple")
                : oResourceBundle.getText("MainController.SuccessDeleteMessageSingle");

            try {
                for (const oItem of aRowsToDelete) {
                    const sPath = `/AISSet(SubClass='${oItem.SubClass}')`;
                    await this.deleteDataRequestToServer(sPath);
                }
                await this._getData("/AISSet", []);
                this.displayMessage("Success", sSuccessMsg);
                this.getModel("parentModel").setProperty("/isFieldEditable", false);
            } catch (oError) {
                let sErrorMessage = "An error occurred while deleting.";
                try {
                    sErrorMessage = JSON.parse(oError.responseText).error.message.value;
                } catch {
                    sErrorMessage = oError.message || sErrorMessage;
                }
                this.displayMessage("Error", sErrorMessage);
            } finally {
                oBusyDialog.close();
            }

            oModel.setProperty("/results", aRemainingRows);
            oTable.clearSelection();
        },

        /**
         * Event handler for switch state change.
         * @param {sap.ui.base.Event} oEvent switch change event
         */
        onSwitchStateChange: function (oEvent) {
            const bState = oEvent.getParameter("state");
            this.getModel("parentModel").setProperty("/isCreateEnabled", bState);
            this.getModel("parentModel").setProperty("/isFieldEditable", bState);
        },

        /**
         * Event handler for cancel button press. Reverts unsaved changes.
         * @param {sap.ui.base.Event} oEvent button press event
         */
        onCancelButtonPress: function (oEvent) {
            const oResourceBundle = this.getResourceBundle();

            if (this._service.canContinueFlag) {
                this._continueCancelAction();
            } else {
                const sConfirmMsg = oResourceBundle.getText("MainController.saveConfirmMessage");
                this._showConfirmationMessage(sConfirmMsg).then((sAction) => {
                    if (sAction === "YES") {
                        this.createPostRequest();
                    } else {
                        this._service.canContinueFlag = true;
                        this._continueCancelAction();
                    }
                });
            }
        },

        /**
         * Reverts table data from backend and notifies user.
         * @private
         */
        _continueCancelAction: function () {
            this._getData("/AISSet", []);
            this.getModel("parentModel").setProperty("/isFieldEditable", false);
            const sCancelMsg = this.getResourceBundle().getText("MainController.onCancelPressMessage");
            MessageToast.show(sCancelMsg, { duration: 2000 });
        },

        /**
         * Event handler for opening the Create New AWL Cost dialog.
         * @param {sap.ui.base.Event} oEvent button press event
         */
        onCreateNewAWLCost: function (oEvent) {
            const oResourceBundle = this.getResourceBundle();

            if (this._service.canContinueFlag) {
                this._onCreateDialogOpen();
            } else {
                const sConfirmMsg = oResourceBundle.getText("MainController.saveConfirmMessage");
                this._showConfirmationMessage(sConfirmMsg).then((sAction) => {
                    if (sAction === "YES") {
                        this.createPostRequest();
                    } else {
                        this._service.canContinueFlag = true;
                        this._onCreateDialogOpen();
                    }
                });
            }
        },

        /**
         * Opens the Create New AIS Cost fragment dialog.
         * @private
         */
        _onCreateDialogOpen: function () {
            this._createNewAWLCostModel();
            if (!this._oAISCostDialog) {
                this._oAISCostDialog = sap.ui.xmlfragment(
                    "com.wel.assetstandardcost.fragments.NewAISSet",
                    this
                );
                this.getView().addDependent(this._oAISCostDialog);
            }
            this._oAISCostDialog.open();
        },

        /**
         * Event handler for closing the Create New AIS Cost dialog.
         * @param {sap.ui.base.Event} oEvent button press event
         */
        onCloseDialogButtonPress: function (oEvent) {
            oEvent.getSource().getParent().close();
        },

        /**
         * Prepares and triggers the post/update request for modified rows.
         */
        createPostRequest: async function () {
            const aRowItemsToPost = this._service.rowItemsToPost;
            const oModel = this.getModel("oJsonAISSetModel");
            const aResults = oModel ? oModel.getProperty("/results") : [];
            const oResourceBundle = this.getResourceBundle();

            const aItemsToPost = aResults.filter((oItem) => aRowItemsToPost.includes(oItem.SubClass));
            this._service.rowItemsToPost = [];

            if (!aItemsToPost.length) {
                this.displayMessage("Error", oResourceBundle.getText("MainController.notingtoPost"));
            } else {
                this._continuePosting(aItemsToPost);
            }
        },

        /**
         * Posts updated rows to the backend OData service.
         * @private
         * @param {object[]} aItems array of row entities to update
         */
        _continuePosting: async function (aItems) {
            const oBusyDialog = new BusyDialog({ title: "POSTING..." });
            const oResourceBundle = this.getResourceBundle();
            oBusyDialog.open();

            const sSuccessMsg = aItems.length > 1
                ? oResourceBundle.getText("MainController.SuccessUpdateMessageMultiple")
                : oResourceBundle.getText("MainController.SuccessUpdateMessageSingle");

            try {
                for (const oItem of aItems) {
                    oItem.StdCost = oItem.StdCost.toString();
                    oItem.StdLife = oItem.StdLife.toString();
                    oItem.Z11kv = oItem.Z11kv.toString();
                    oItem.Z33kv = oItem.Z33kv.toString();
                    oItem.Zlv = oItem.Zlv.toString();
                    const sPath = `/AISSet(SubClass='${oItem.SubClass}')`;
                    delete oItem.__metadata;
                    await this.updateDataToServer(sPath, oItem);
                    this.getModel("parentModel").setProperty("/isFieldEditable", false);
                }
                await this._getData("/AISSet", []);
                this.displayMessage("Success", sSuccessMsg);
            } catch (oError) {
                let sErrorMessage = "An error occurred while posting data.";
                try {
                    sErrorMessage = JSON.parse(oError.responseText).error.message.value;
                } catch {
                    sErrorMessage = oError.message || sErrorMessage;
                }
                this.displayMessage("Error", sErrorMessage);
            } finally {
                oBusyDialog.close();
            }
        },

        /**
         * Event handler for opening the SubClass value help dialog.
         */
        onSubClassValueHelpPress: function () {
            if (!this._pValueHelpDialog) {
                this._pValueHelpDialog = Fragment.load({
                    name: "com.wel.assetstandardcost.fragments.ValueHelpDialogAssetSubClass",
                    controller: this
                }).then((oDialog) => {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pValueHelpDialog.then((oDialog) => {
                oDialog.open();
            });
        },

        /**
         * Validates mandatory field and creates a new AIS cost entry.
         */
        onCreateNewAILAssetCost: async function () {
            const sSubClass = this.getModel("newAISJsonModel").getProperty("/SubClass");
            if (!sSubClass) {
                this.getModel("newAISJsonModel").setProperty("/SubClassValueState", "Error");
            } else {
                this._createNewAwlCost();
            }
        },

        /**
         * Submits creation payload for new AIS cost item to backend.
         * @private
         */
        _createNewAwlCost: async function () {
            const oModel = this.getModel("newAISJsonModel");
            const oPayload = Object.assign({}, oModel.getProperty("/"));
            const oResourceBundle = this.getResourceBundle();
            delete oPayload.SubClassValueState;

            const oBusyDialog = new BusyDialog({ title: "CREATING..." });
            oBusyDialog.open();

            try {
                const sPath = "/AISSet";
                await this.postDataToServer(sPath, oPayload);
                await this._getData("/AISSet", []);
                this._oAISCostDialog.close();
                this._createNewAWLCostModel();
                this.displayMessage("Success", oResourceBundle.getText("MainController.SuccessCreateMessage"));
                this.getModel("parentModel").setProperty("/isFieldEditable", true);
            } catch (oError) {
                let sErrorMessage = "An error occurred while creating entry.";
                try {
                    sErrorMessage = JSON.parse(oError.responseText).error.message.value;
                } catch {
                    sErrorMessage = oError.message || sErrorMessage;
                }
                this.displayMessage("Error", sErrorMessage);
            } finally {
                oBusyDialog.close();
            }
        },

        /**
         * Tracks row modification when description text changes.
         * @param {sap.ui.base.Event} oEvent change event
         */
        onTextChange: function (oEvent) {
            const oRow = oEvent.getSource()
                .getBindingContext("oJsonAISSetModel")
                .getObject();

            if (oRow && !this._service.rowItemsToPost.includes(oRow.SubClass)) {
                this._service.rowItemsToPost.push(oRow.SubClass);
            }
        },

        /**
         * Validates numeric input values and tracks row modification.
         * @param {sap.ui.base.Event} oEvent input change event
         */
        onInputValueChange: function (oEvent) {
            this._service.canContinueFlag = false;
            const oSource = oEvent.getSource();
            let sNewValue = oEvent.getParameter("newValue") || "";

            if (sNewValue[0] === "0" && sNewValue[1] !== ".") {
                sNewValue = sNewValue.slice(1);
            }

            if (!oSource.getId().includes("id_subclasscat")) {
                const regex = oSource.getId().includes("id_stdCost")
                    ? /^[0-9]{0,10}(?:\.[0-9]{0,2})?$/
                    : /^[0-9]{0,3}(?:\.[0-9]{0,2})?$/;
                const match = sNewValue.match(regex);
                if (!(match !== null && match.input !== "")) {
                    sNewValue = sNewValue.slice(0, -1) || 0;
                    oSource.setValue(sNewValue);
                }
            }
            oSource.setValue(sNewValue);

            const oContext = oEvent.getSource().getBindingContext("oJsonAISSetModel");
            if (oContext) {
                const oData = oContext.getObject();
                if (oData && !this._service.rowItemsToPost.includes(oData.SubClass)) {
                    this._service.rowItemsToPost.push(oData.SubClass);
                }
            }
        },

        /**
         * Filters subclass items in the value help dialog.
         * @param {sap.ui.base.Event} oEvent search event
         */
        onSearchSubClass: function (oEvent) {
            const sValue = oEvent.getParameter("value") || "";
            const oFilter = new Filter(
                [
                    new Filter("SubClass", FilterOperator.Contains, sValue.toUpperCase()),
                    new Filter("SubClassDesc", FilterOperator.Contains, sValue.toUpperCase())
                ],
                false
            );
            const oItemsBinding = oEvent.getParameter("itemsBinding");
            if (oItemsBinding) {
                oItemsBinding.filter([oFilter]);
            }
        },

        /**
         * Handles item selection in Asset Subclass value help dialog.
         * @param {sap.ui.base.Event} oEvent dialog confirm or cancel event
         */
        onAssetSubclassDialogClose: function (oEvent) {
            this.getModel("newAISJsonModel").setProperty("/SubClassValueState", "None");
            const oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                const oModelData = this.getModel("newAISJsonModel").getProperty("/");
                oModelData.SubClass = oSelectedItem.getTitle();
                oModelData.SubClassDesc = oSelectedItem.getDescription();
                oModelData.AssetClass = oSelectedItem.getInfo();
                this.getModel("newAISJsonModel").setProperty("/", oModelData);
            }
        },

        /**
         * Event handler for edit toggle button press.
         * @param {sap.ui.base.Event} oEvent button press event
         */
        onToggleButtonPress: function (oEvent) {
            const bPressed = oEvent.getParameter("pressed");
            this.getModel("parentModel").setProperty("/isCreateEnabled", bPressed);
            this.getModel("parentModel").setProperty("/isFieldEditable", bPressed);
        },

        /**
         * Displays a confirmation dialog returning a Promise resolving with the user action.
         * @private
         * @param {string} sMessage confirmation message
         * @returns {Promise<string>} promise resolving with action chosen ("YES" | "NO")
         */
        _showConfirmationMessage: function (sMessage) {
            return new Promise((resolve) => {
                MessageBox.confirm(sMessage, {
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: resolve
                });
            });
        }
    });
});
