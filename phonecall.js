if (typeof (Project) == "undefined") {
    Project = {};
}

Project.Phonecall = {
    controlsToHideComagic: [
        "crmpark_comagic_is_missed_call",
        "crmpark_calldurationsec",
        "crmpark_comagic_reason",
        "crmpark_comagic_is_requested_call",
        "crmpark_recdurationsec",
        "crmpark_comagic_source",
        "crmpark_employee_phonenumber",
        "crmpark_incoming_phonenumber"
    ],

    controlsToHide: [
        "new_object",
        "regardingobjectid",
        "new_articleid",
        "crmpark_recduration",
        "new_tred_in",
        "new_repeatedconsultation",
        "new_transfer",
        "new_new_zaauto",
        "new_transfer_2",
        "new_new_zaauto2",
        "project_advertisingid"
    ],

    //Поля, которые нужно переносить в новую запись Звонка при переводе Звонка
    //fieldName - название поля
    //fieldType - тип поля (simple: поля с типом picklist, string, int, decimal и т.д.)
    fieldsToTransferOnTransfer: [
        { fieldName: "directioncode", fieldType: "simple" },
        { fieldName: "phonenumber", fieldType: "simple" },
        { fieldName: "regardingobjectid", fieldType: "lookup" },
        { fieldName: "crmpark_contact_fullname", fieldType: "simple" },
        { fieldName: "crmpark_classifierid", fieldType: "lookup" },
        { fieldName: "description", fieldType: "simple" },
        { fieldName: "new_klasszvonkatest", fieldType: "simple" },
        { fieldName: "Project_main_interest2", fieldType: "simple" },
        { fieldName: "new_object", fieldType: "simple" },
        { fieldName: "crmpark_communication_typecode", fieldType: "simple" },
        { fieldName: "crmpark_connected_userid", fieldType: "lookup" },
        { fieldName: "new_missedcall", fieldType: "simple" },
        { fieldName: "new_zaauto2", fieldType: "lookup" },
        { fieldName: "subject", fieldType: "simple" },
        { fieldName: "crmpark_lineid", fieldType: "lookup" }
    ],



    classifierCode: "БЧ",

    operatorCallCenter: {
        requiredFields: ["new_object", "ownerid", "subject", "statecode", "phonenumber", "new_klasszvonkatest"],
        formGUID: "2A2046A-24ED-4947-B7D5-182DD00A8E45"
    },

    onLoad: async function (executionContext) {

        var formContext = Project.Common.getFormContext(executionContext);
        var formItem = formContext.ui.formSelector.getCurrentItem();
        var formId = formItem.getId().toUpperCase();

        var directioncode = formContext.getAttribute("directioncode");
        var params = formContext.context.getQueryStringParameters();

        // Отправляем контекст в историю звонков (chess_historyinteractions_v9.htm)
        await Project.Phonecall.loadContextForHistory(executionContext);
        await Project.Phonecall.loadContextForTranscriptions(executionContext);

        await Project.Phonecall.populateIccIframeUrl(formContext);
        /*Project.Phonecall.openFormForMts();*/
        Project.Phonecall.checkLeadInfo(formContext);
        Project.Phonecall.fillDateField(executionContext);

        //Данное автообновление не подходит под форму ОператорКЦ
        if (formId != Project.Phonecall.operatorCallCenter.formGUID) {
            Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_klasszvonkatest", Project.Phonecall.onKlasszvonkatesChange);
        }
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_transfer", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_object", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "crmpark_contact_fullname", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "Project_main_interest2", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_isrooms1", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_isrooms2", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_isrooms3", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_isrooms4", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_isuninhabited", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "new_isgarage", Project.Phonecall.onFieldsChange);
        Project.Phonecall.addOnChangeIfFieldExists(formContext, "from", Project.Phonecall.onCustomerChange);

        /// formContext.data.entity.addOnSave(Project.Phonecall.checkContactFieldBeforeSaving); // MDC-533

        //обработчик обновление ribbon при изменении полей, влияющих на доступность кнопки "Карточка клиента"
        if (directioncode) {
            directioncode.addOnChange(Project.Phonecall.refreshRibbon);
        }

        formContext.getAttribute("to").addOnChange(Project.Phonecall.refreshRibbon);
        formContext.getAttribute("from").addOnChange(Project.Phonecall.refreshRibbon);

        if (formContext.ui.getFormType() === 1) { //create
            var originalParams = formContext.getAttribute("crmpark_originalparams");
            if (originalParams) {
                const jsonString = JSON.stringify(params);
                originalParams.setValue(jsonString);
            }
            if (directioncode && typeof directioncode.getValue() === 'boolean') {
                directioncode.addOnChange(Project.Phonecall.directionCodeOnChange);
                var sectionIncomingCall = formContext.ui.tabs.get("phonecall").sections.get("phonecall_incoming_call");
                if (sectionIncomingCall) {
                    sectionIncomingCall.setVisible(!directioncode.getValue())
                }

            }

            // Установка направления, в случае переданного входящего номера
            Project.Phonecall.setDirection(executionContext, params);

            // Заполнение полей по предыдущему Звонку, в случае трансфера
            await Project.Phonecall.fillTransferedCall(formContext, params.prevdoc_id);

            //если ID звонка явно не передан, попытка поиска по call section
            if (!params.prevdoc_id && params.call_section) {
                var phoneCall = await Project.Phonecall.findPhoneCallBySection(params.call_section);
                if (phoneCall) {
                    await Project.Phonecall.fillTransferedCall(formContext, phoneCall);
                }
            }

            if (!params.prevdoc_id && params.calledid_0) {
                await Project.Phonecall.setCCLine(formContext, params.calledid_0);
            }
            if (formId == Project.Phonecall.operatorCallCenter.formGUID) {
                Project.Phonecall.configureCallCenterFormAutosave(executionContext);
            }

            else {
                formContext.getAttribute("new_klasszvonkatest")?.addOnChange(Project.Phonecall.checkNeedSaveCall);
                formContext.getAttribute("ownerid")?.addOnChange(Project.Phonecall.checkNeedSaveCall);
                formContext.getAttribute("crmpark_lineid")?.addOnChange(Project.Phonecall.checkNeedSaveCall);
                formContext.getAttribute("regardingobjectid")?.addOnChange(Project.Phonecall.checkNeedSaveCall);
                formContext.getAttribute("phonenumber")?.addOnChange(Project.Phonecall.checkNeedSaveCall);
                formContext.getAttribute("subject")?.addOnChange(Project.Phonecall.checkNeedSaveCall);

                await Project.Phonecall.checkNeedSaveCall(executionContext);
            }
            // Установка МОПа


            var factProjectField = formContext.getAttribute("crmpark_classifierid");
            var clientFieldName = directioncode.getValue() ? "to" : "from";
            var clientField = formContext.getAttribute(clientFieldName);

            if (factProjectField && clientField) {
                factProjectField.addOnChange(function () { Project.Phonecall.checkAndGetMOP(executionContext) });
                clientField.addOnChange(function () { Project.Phonecall.checkAndGetMOP(executionContext) });
                console.log("Установлен триггер addOnChange для поля " + clientFieldName);
            }
            if (params.is_callback && JSON.parse(params.is_callback.toLowerCase()) === true && params.phonenumber) {
                var outboundMessage = "Звонок является автоперезвоном";
                //В случае, если звонок по Исходящей кампании Калининграда (звонок выполняется с суффиксом 18)
                if (params.phonenumber.startsWith("18")) outboundMessage = outboundMessage + " по Калининграду"; 
                formContext.ui.setFormNotification(outboundMessage, "INFO", "callback");
            }
        }

        Project.Phonecall.populateFieldsFromOpener(executionContext);

        if (formContext.getAttribute('crmpark_iscomagic') !== null && formContext.getAttribute('crmpark_iscomagic').getValue() === true) {
            Project.Phonecall.hideNonComagicFields(executionContext);
        }
        else {
            Project.Phonecall.hideComagicFields(executionContext);
        }

    },

    // Функция отправки контекста в html окно на форме (история)
    loadContextForHistory: async function (executionContext) {
        var formContext = Project.Common.getFormContext(executionContext);

        var wrControl = formContext.getControl("WebResource_history");
        // Если html ресурс присутствует на форме
        if (wrControl) {
            try {
                // Метод для UCI: Вызываем метод в html окне для принятия контекста
                wrControl.getContentWindow().then(
                    function (contentWindow) {
                        contentWindow.Project.History.setClientApiContext(formContext);
                    }
                )
            } catch {
                // Метод для Legacy: Сохраняем контекст в контейнере окна
                window.top.formContext = formContext;
            }
        }
    },

    // Функция отправки контекста в html окно на форме (расшифровка звонка))
    loadContextForTranscriptions: async function (executionContext) {
        var formContext = Project.Common.getFormContext(executionContext);

        var wrControl = formContext.getControl("WebResource_callstranscriptions");
        // Если html ресурс присутствует на форме
        if (wrControl) {
            // Вызываем метод в html окне для принятия контекста
            wrControl.getContentWindow().then(
                function (contentWindow) {
                    contentWindow.Project.CallTranscription.setClientApiContext(formContext);
                }
            )
        }
    },

    fillDateField: function (executionContext) {

        var formContext = Project.Common.getFormContext(executionContext);
        var dateField = formContext.getAttribute("crmpark_timeopen");

        if (dateField) {
            if (dateField.getValue() == null) {
                dateField.setValue(new Date());
            }
        }
    },

    onKlasszvonkatesChange: function (executionContext) {

        Project.Common.getFormContext(executionContext).data.save();
    },

    checkLeadInfo: function (formContext) {

        var leadInfo = formContext.getAttribute("crmpark_leadinfo");

        if (leadInfo != null && leadInfo.getValue() != null && formContext.ui.getFormType() == 1) {
            var leadValue = leadInfo.getValue().split("||");

            if (leadValue[0] != null) {
                var newLead =
                    [{
                        id: leadValue[0],
                        name: leadValue[1],
                        entityType: "lead"
                    }]

                formContext.getAttribute("regardingobjectid")?.setValue(newLead);
            }
        }
    },

    directionCodeOnChange: function (executionContext) {

        ///<summary>Логика на изменения поля "Направление"</summary>
        var formContext = Project.Common.getFormContext(executionContext);
        var directioncode = formContext.getAttribute("directioncode"),
            subject = formContext.getAttribute("subject"),
            titleDefault = "Исходящий звонок";
        if (directioncode) {
            var tabs = formContext.ui.tabs;
            if (tabs && tabs.get("phonecall") && tabs.get("phonecall").sections.length > 0 && tabs.get("phonecall").sections.get("phonecall_incoming_call"))
                tabs.get("phonecall").sections.get("phonecall_incoming_call").setVisible(!directioncode.getValue());
            if (subject) {
                if (directioncode.getValue()) {
                    subject.setValue(titleDefault);
                } else {
                    var currentTitle = subject.getValue() || "";
                    subject.setValue(currentTitle.replace(titleDefault, ""));
                }
            }
        }
    },

    setDirection: function (executionContext, params) {
        ///<summary>Если передали directioncode_value - то при 0 ставим "Входящий", при 1 "Исходящий" 
        //Иначе, если передали номер из входящего звонка - устанавливаем направление звонка на "Входящий" </summary>
        ///<param name="params">Параметры запроса</param>
        var formContext = Project.Common.getFormContext(executionContext);
        var directioncode = formContext.getAttribute("directioncode");

        if (params.directioncode_value != null) {
            var directionCodeValueToSet = params.directioncode_value == 0 ? false : true;
            directioncode.setValue(directionCodeValueToSet);
        }

        else if (params.phonenumber && directioncode) {
            if (directioncode.getValue()) {
                directioncode.setValue(false);
                var section = formContext.ui.tabs.get("phonecall").sections.get("phonecall_incoming_call");
                if (section) {
                    section.setVisible(true);
                }
            }
        }
    },

    fillTransferedCall: async function (formContext, prevDocId) {

        ///<summary>
        /// Если в URL формы создания нового звонка в параметрах передан prevdoc_id (GUID звонка, с которого выполнялся трансфер), 
        /// то необходимо заполнить все поля карточки звонка значениями с формы звонка prevdoc_id.
        ///</summary>
        ///<param name="prevDocId">GUID звонка, с которого выполнялся трансфер</param>
        if (prevDocId) {
            try {
                var id = prevDocId.replace("{", "").replace("}", "");

                var fieldsArray = [];
                Project.Phonecall.fieldsToTransferOnTransfer.forEach(function (field) {
                    if (field.fieldType == "lookup") {
                        fieldsArray.push(`_${field.fieldName}_value`)
                    } else {
                        fieldsArray.push(field.fieldName);
                    }
                });

                var prevDoc = await Xrm.WebApi.retrieveRecord("phonecall", id, `?$select=${fieldsArray}`);

                var prevDocDirectionValue = prevDoc.directioncode;

                const activityPartyResult = await Xrm.WebApi.retrieveMultipleRecords("activityparty",
                    `?$filter=_activityid_value eq ${id}&$select=_partyid_value,participationtypemask`
                );


                const toParties = activityPartyResult.entities.filter(p => p.participationtypemask === 2); // Кому
                const fromParties = activityPartyResult.entities.filter(p => p.participationtypemask === 1); // От кого

                const convertToLookupValue = function (id, entityType, name) {
                    return [{
                        id: id,
                        entityType: entityType,
                        name: name
                    }];
                };

                const convertParty = function (party) {

                    return [{
                        id: party._partyid_value,
                        entityType: party["_partyid_value@Microsoft.Dynamics.CRM.lookuplogicalname"],
                        name: party["_partyid_value@OData.Community.Display.V1.FormattedValue"]
                    }];
                };

                var prevCallLooup = [{
                    id: id,
                    entityType: "phonecall",
                    name: prevDoc.subject
                }]

                formContext.getAttribute("new_prevdocid").setValue(prevCallLooup);
                var noneReplacedFields = ["crmpark_lineid", "regardingobjectid"];

                Project.Phonecall.fieldsToTransferOnTransfer.forEach(function (field) {
                    const attribute = formContext.getAttribute(field.fieldName);
                    if (!attribute) return;

                    if (noneReplacedFields.indexOf(field.fieldName) >= 0 && attribute.getValue() != null) {
                        return;
                    }

                    // Проверяем, является ли поле лукапом
                    if (field.fieldType == "lookup" && prevDoc[`_${field.fieldName}_value`]) {
                        const id = prevDoc[`_${field.fieldName}_value`];
                        const entityType = prevDoc[`_${field.fieldName}_value@Microsoft.Dynamics.CRM.lookuplogicalname`];
                        const nameValue = prevDoc[`_${field.fieldName}_value@OData.Community.Display.V1.FormattedValue`] || "";

                        attribute.setValue(convertToLookupValue(id, entityType, nameValue));
                    } else if (prevDoc[field.fieldName] != null) {
                        // В остальных случаях считаем как простые типы: строка, дата, число и т.д.
                        attribute.setValue(prevDoc[field.fieldName]);
                    }

                    attribute.setSubmitMode("always");
                });


                if (prevDocDirectionValue == true) {
                    const toAttribute = formContext.getAttribute("to");
                    if (toAttribute && toParties.length > 0) {
                        var value = convertParty(toParties[0]);
                        toAttribute.setValue(value);
                    }

                    const fromAttribute = formContext.getAttribute("from");
                    if (fromAttribute) {
                        fromAttribute.setValue([{
                            id: formContext.context.getUserId(),
                            entityType: "systemuser",
                            name: formContext.context.getUserName()
                        }]);
                    }
                }

                else if (prevDocDirectionValue == false) {
                    const fromAttribute = formContext.getAttribute("from");
                    if (fromAttribute && fromParties.length > 0) {
                        var value = convertParty(fromParties[0]);
                        fromAttribute.setValue(value);
                        //fromAttribute.setValue(fromParties.map(convertParty));
                    }
                }

                formContext.getAttribute("new_transfer")?.setValue(true);
                //4004 Автоматическое сохранение карточки звонка при переводе звонка
                //Ставим таймаут в 1с перед сохранинем, т.к. большое количество attribute.setValue не успевает обработаться. 
                setTimeout(function () {
                    formContext.data.save().then(function () {
                        formContext.data.refresh(false);
                        let oppor = formContext.getAttribute("new_zaauto2")?.getValue();

                        if (oppor) {
                            Xrm.Navigation.openForm({
                                entityName: oppor[0].entityType,
                                entityId: oppor[0].id
                            });
                            window.close();
                        }
                    })
                }, 1000)
            }
            catch (error) {
                console.log(JSON.stringify(error))
                Xrm.Navigation.openAlertDialog({
                    text: "Возникла ошибка при заполнении данных при переводе. Пожалуйста, обратитесь к системному администратору. Текст ошибки: " + JSON.stringify(error),
                    title: "Ошибка заполнения данных"
                }, {
                    height: 200,
                    width: 450
                })
            }
        }
    },

    setCCLine: async function (formContext, lineNumber) {

        var lineAttr = formContext.getAttribute("crmpark_lineid");
        var regardingAttr = formContext.getAttribute("regardingobjectid");
        if (lineAttr) {
            let line = null;
            var fetch = "<fetch mapping='logical' count='10'>";
            fetch += "<entity name='crmpark_mightycall_line'>";
            fetch += "<attribute name='crmpark_name' />";
            fetch += "<attribute name='crmpark_mightycall_lineid' />";
            fetch += "<attribute name='new_classifierid' />";
            fetch += "   <filter type='and'>";
            fetch += "      <condition attribute='crmpark_lines' operator='like' value='%" + lineNumber + "%'/>";
            fetch += "   </filter>";
            fetch += "</entity></fetch>";
            var encodedFetchXml = encodeURIComponent(fetch);
            var result = await Xrm.WebApi.retrieveMultipleRecords(
                "crmpark_mightycall_line",
                `?fetchXml=${encodedFetchXml}`
            );

            result = result.entities || [];

            if (result.length > 0) {

                let id = result[0]["crmpark_mightycall_lineid"];
                let name = result[0]["crmpark_name"];

                line = [{ "id": id, "name": name, "entityType": "crmpark_mightycall_line" }];

                let project = result[0]["_new_classifierid_value"];
                if (project != null) {
                    let projectRef = [{ "id": project, "name": result[0]["_new_classifierid_value@OData.Community.Display.V1.FormattedValue"], "entityType": "project_classifier" }];
                    if (regardingAttr.getValue() == null) {
                        regardingAttr.setValue(projectRef);
                    }
                }
            }
            lineAttr.setValue(line);
        }
    },
    //4013 Анализ по задаче передача звонка от КЦ в ОП
    ///<summary>Запретить переводить звонок, если не заполнено поле "Звонок от кого"</summary>
    checkContactFieldBeforeSaving: function (executionContext) {

        //Форма создания
        var formContext = Project.Common.getFormContext(executionContext);
        var params = formContext.context.getQueryStringParameters();

        //Для формы "Оператор КЦ" данная логика не требуется.
        var formItem = formContext.ui.formSelector.getCurrentItem();
        var formId = formItem.getId().toUpperCase();

        if (formContext.ui.getFormType() === 1 && params.prevdoc_id == null && formId != Project.Phonecall.operatorCallCenter.formGUID) {
            var contactFieldName;
            let directionCodeValue = formContext.getAttribute("directioncode")?.getValue();
            if (typeof directionCodeValue === 'boolean') {
                contactFieldName = directionCodeValue ? "to" : "from";
            }
            if (contactFieldName) {
                var contactField = formContext.getAttribute(contactFieldName);
                if (contactField != null) {
                    var fieldValue = contactField.getValue();

                    if (fieldValue == null || fieldValue[0].entityType == "systemuser") {
                        contactField.setValue(null);
                        contactField.setRequiredLevel('required');

                        formContext.getControl(contactFieldName).setNotification("Укажите запись Физ. лица или Заявки!", "1");
                    }
                }
            }
        }
    },

    onCustomerChange: function (executionContext) {

        var formContext = Project.Common.getFormContext(executionContext);

        var contactField = formContext.getAttribute("from");
        if (contactField != null && contactField.getValue() != null) {
            formContext.getControl("from").clearNotification("1");
        }
    },

    //К удал (функция к старому коннектору)
    populateIccIframeUrl: async function (formContext) {

        if (typeof MCE !== 'undefined') return;
        var frame = formContext.ui.controls.get('IFRAME_ICC');

        //получить ответственного
        let settings = null;
        const ownerId = formContext.getAttribute("ownerid").getValue()[0].id;
        const owner = await Xrm.WebApi.retrieveRecord(
            "systemuser",
            ownerId,
            "?$select=_crmpark_profileid_value"
        );

        //получить профиль с карточки или профиль по умолчанию
        if (owner._crmpark_profileid_value) {
            // Получаем настройки профиля
            settings = await Xrm.WebApi.retrieveRecord(
                "crmpark_mightycall_profile",
                owner._crmpark_profileid_value,
                "?$select=crmpark_url"
            );
            console.log("Берем профиль из пользователя.");
        } else {
            const fetchXml = `
                <fetch mapping='logical' count='10'>
                    <entity name='crmpark_mightycall_profile'>
                        <attribute name='crmpark_url' />
                        <filter type='and'>
                            <condition attribute='crmpark_isdefault' operator='eq' value='1'/>
                        </filter>
                    </entity>
                </fetch>`;

            const encodedFetch = encodeURIComponent(fetchXml);
            const result = await Xrm.WebApi.retrieveMultipleRecords(
                "crmpark_mightycall_profile",
                `?fetchXml=${encodedFetch}`
            );

            if (result.entities.length > 0) {
                console.log("Берем профиль по умолчанию.");
                settings = result.entities[0];
            }
        }

        if (settings == null) {
            var alertStrings = { confirmButtonLabel: "ОК", text: "Не найдены настройки контакт-центра. Обратитесь к администратору.", title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );

            return;
        }

        let iccUrl = settings["crmpark_url"];
        console.log("Используем адрес " + iccUrl);
        var frame = formContext.ui.controls.get('IFRAME_ICC');
        var source = frame.getSrc();
        if (source !== iccUrl)
            frame.setSrc(iccUrl);
        console.log("Адрес: " + frame.getSrc());
    },

    checkNeedSaveCall: async function (executionContext) {

        var formContext = Project.Common.getFormContext(executionContext);
        var ownerLookup = formContext.getAttribute("ownerid").getValue();
        var klasszvonkatest = formContext.getAttribute("new_klasszvonkatest")?.getValue();

        var crmpark_lineidLookup = formContext.getAttribute("crmpark_lineid")?.getValue();
        if (ownerLookup && klasszvonkatest && crmpark_lineidLookup) {
            if (klasszvonkatest === 100000000) {
                let line = await Xrm.WebApi.retrieveRecord(
                    "crmpark_mightycall_line",
                    crmpark_lineidLookup[0].id,
                    "$select=_new_classifierid_value&$expand=new_classifierid($select=project_code)"
                );

                const projectCode = line.new_classifierid?.project_code;

                if (projectCode != null && projectCode === Project.Phonecall.classifierCode) {
                    var currentUserId = Xrm.Utility.getGlobalContext().userSettings.userId;
                    var isCorrectUserRole = await Project.Common.checkUserRoleByName(currentUserId, 'АРК - Менеджер') || Project.Common.checkUserRoleByName(currentUserId, 'АРК - Управляющий Продажами');

                    if (isCorrectUserRole) {
                        formContext.data.save().then(function () {

                            formContext.data.refresh(false);
                            let oppor = formContext.getAttribute("new_zaauto2")?.getValue();
                            if (oppor) {
                                Xrm.Navigation.openForm({
                                    entityName: oppor[0].entityType,
                                    entityId: oppor[0].id
                                });
                                window.close();
                            }
                        });
                    }
                }
            }
        }
    },

    /*    openFormForMts: function (executionContext) {
            var isMtsCall = getAttribute("crmpark_from_mts").getValue();
            if (!isMtsCall) {
                return;
            }
            var section = Project.Phonecall.getSection(executionContext, 'phonecall', 'callcenter_integration');
            if (section != null) {
                section.setVisible(false);
            }
        },
    */

    getSection: function (executionContext, tabName, sectionName) {

        var formContext = Project.Common.getFormContext(executionContext);
        var tab = formContext.ui.tabs.get(tabName);
        if (tab) {
            return tab.sections.get(sectionName);
        }
        return null;
    },

    hideComagicFields: function (executionContext) {

        var formContext = Project.Common.getFormContext(executionContext);

        for (var i = 0; i < Project.Phonecall.controlsToHideComagic.length; i++) {
            var control = formContext.getControl(Project.Phonecall.controlsToHideComagic[i]);
            if (typeof control != "undefined" && control != null) {
                control.setVisible(false);
            }
        }
    },

    hideNonComagicFields: function (executionContext) {

        var formContext = Project.Common.getFormContext(executionContext);

        for (var i = 0; i < Project.Phonecall.controlsToHide.length; i++) {
            var control = formContext.getControl(Project.Phonecall.controlsToHide[i]);
            if (typeof control != "undefined" && control != null) {
                control.setVisible(false);
            }
        }
        var section = Project.Phonecall.getSection(executionContext, 'phonecall', 'callcenter_integration');
        if (section != null) {
            section.setVisible(false);
        }
    },

    onFieldsChange: function (executionContext) {

        ///<summary> Формирует и присваивает строку темы заявки. </summary>


        var formContext = Project.Common.getFormContext(executionContext);
        var subject = "";

        var newObject = formContext.getAttribute("new_object");
        if (newObject && newObject.getText())
            subject += newObject.getText() + ", ";

        var newFullName = formContext.getAttribute("crmpark_contact_fullname");
        if (newFullName && newFullName.getValue())
            subject += newFullName.getValue() + ", ";

        var newMainInterest = formContext.getAttribute("Project_main_interest2");
        if (newMainInterest && newMainInterest.getText())
            subject += newMainInterest.getText()

        formContext.getAttribute("subject").setValue(subject.replace(/,\s*$/, ""));
    },

    populateFieldsFromOpener: function (executionContext) {

        ///<summary>Предзаполнение полей через postMessage</summary>
        var formContext = Project.Common.getFormContext(executionContext);
        if (!window.top.opener) return;

        window.top.addEventListener("message", listener);
        window.top.opener.postMessage({ action: "loaded" }, "*");

        function listener(event) {

            if (!event.data || event.data.action !== "fields") return;

            var fieldsData = event.data.fieldsData;
            for (var field in fieldsData) {
                if (!fieldsData.hasOwnProperty(field)) continue;

                var fieldParam = fieldsData[field],
                    attr = formContext.getAttribute(field);
                if (attr) {
                    attr.setValue(fieldParam.val);
                    fieldParam.changeFire && attr.fireOnChange();
                }
            }
        }
    },

    //Используется при изменении Звонить От, Звонить К
    refreshRibbon: function (executionContext) {

        var formContext = Project.Common.getFormContext(executionContext);
        formContext.ui.refreshRibbon();
    },

    findPhoneCallBySection: async function (callSection) {

        const result = await Xrm.WebApi.retrieveMultipleRecords(
            "phonecall",
            `?$select=activityid&$filter=new_callsectionguid eq '${callSection}'&$orderby=createdon desc`
        );

        if (result.entities.length > 0) {
            return result.entities[0].activityid;
        }

        return null;
    },

    //К удалению (неактуальная интеграция с МТС)
    // listenMtsCall: async function (executionContext) {

    //     var formContext = Project.Common.getFormContext(executionContext);
    //     var isMtsCall = formContext.getAttribute("crmpark_from_mts").getValue();
    //     if (!isMtsCall) {
    //         var alertStrings = { confirmButtonLabel: "ОК", text: 'Звонок не из МТС!', title: "Ошибка!" };
    //         var alertOptions = { height: 260, width: 400 };
    //         Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
    //             function (success) {
    //                 console.log("Alert dialog closed");
    //             },
    //             function (error) {
    //                 console.log(error.message);
    //             }
    //         );
    //     }

    //     var response = await Project.Common.runActionByNameWithReturn(executionContext, 'crmpark_DownloadMtsCall');
    //     var result = { FileName: response.FileName, FileContent: response.FileContent };
    //     var dataLink = "data:audio/mp3;base64," + result.FileContent;
    //     var parsedFileName = result.FileName.split('=')[1].split('.');

    //     download(dataLink, parsedFileName[0], 'audio/mp3');
    // },

    //Обработчик клика кнопки "Карточка Клиента"
    openCustomerForm: function (primaryControl) {

        var formContext = Project.Common.getFormContext(primaryControl);

        var directioncode = formContext.getAttribute("directioncode");
        if (!directioncode) {
            var alertStrings = { confirmButtonLabel: "ОК", text: "Невозможно открыть карточку клиента. Поле c направлением звонка не находится на форме", title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );
            return;
        }
        var isOutgoingPhonecall = directioncode.getValue();
        var customerAttribute = isOutgoingPhonecall ? "to" : "from";
        var lookupList = formContext.getAttribute(customerAttribute)?.getValue();
        if (!lookupList || lookupList.length == 0) {
            var alertStrings = { confirmButtonLabel: "ОК", text: "Невозможно открыть карточку клиента. Поле на клиента не заполнена", title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );

            return;
        }
        var lookup = lookupList[0];
        if (lookup.entityType !== "contact" & lookup.entityType !== "account" && lookup.entityType !== "lead") {
            var alertStrings = { confirmButtonLabel: "ОК", text: "Невозможно открыть карточку клиента. Требуется ссылка на физ.лицо, юр.лицо или заявку.", title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );

            return;
        }

        Xrm.Navigation.openForm({
            entityName: lookup.entityType,
            entityId: lookup.id,
            formType: "entityrecord",
            openInNewWindow: true
        });

        window.focus();
    },
    /** Перевод звонка в Заявку
     * В случае Направления="Входящий" берет значения для Клиента из from, "Исходящий" - to
     * При нажатии на кнопку для создания Заявки проверяются следующие условия: 
     1) В поле from/to должно быть значение 
     2) В поле from/to тип записи должен быть "Физ. лицо" или же "Юр. лицо" 
     3) Если заполнено поле "Объект недвижимости", то в нем должна стоять запись ОН в статусе «Свободно» ,«Устная бронь» и «Бронь». 
     По умолчанию берет данные из "Звонок от кого", если Направление не заполнено
     * */
    convertToLead: async function (primaryControl) {

        var formContext = Project.Common.getFormContext(primaryControl);
        var directionField = formContext.getAttribute("directioncode");

        var directionValue = directionField.getValue() == null ? "from" : directionField.getValue() == 0 ? "from" : "to";
        var directionName = directionValue === "from" ? "Звонок от кого" : "Звонок кому";
        var customerLookupList = formContext.getAttribute(directionValue)?.getValue();

        /* // MDC-529
        if (!customerLookupList || customerLookupList.length === 0) {
            var alertStrings = { confirmButtonLabel: "ОК", text: "Новая заявка не может быть создана. Не указан клиент.", title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );

            return;
        }

        var toLookup = customerLookupList[0];
        */ // MDC-529

        var toLookup = customerLookupList && customerLookupList.length > 0
            ? customerLookupList[0]
            : null;

        /* // MDC-529
        if (toLookup.entityType !== "contact" & toLookup.entityType !== "account") {
            var alertStrings = { confirmButtonLabel: "ОК", text: "Новая заявка не может быть создана. В поле \"" + directionName + "\" должен быть указан контакт или организация.", title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );

            return;
        }
     */ // MDC-529

        var advertisingLead = null;
        var advertisingPhonecall = formContext.getAttribute("project_advertisingid")?.getValue();
        if (advertisingPhonecall && advertisingPhonecall.length > 0) {

            advertisingLead = { id: advertisingPhonecall[0].id, logicalName: advertisingPhonecall[0].entityType, type: "EntityReference" };
        }

        var mobileNumber = null;
        var aonNumber = null;

        var rawPhoneNumberField = formContext.getAttribute("phonenumber")
        if (rawPhoneNumberField) {
            var rawPhoneNumber = rawPhoneNumberField.getValue();
            aonNumber = rawPhoneNumber;
            if (rawPhoneNumber.startsWith("98")) {
                aonNumber = rawPhoneNumber.replace(/^98?/, "7");
            }
            else if (rawPhoneNumber.startsWith("+7")) {
                aonNumber = rawPhoneNumber.replace(/^\+7?/, "7");
            }

            //format to  7 (902) 474-73-91;
            let r = aonNumber.replace(/\D/g, '').match(/(\d)(\d{3})(\d{3})(\d{2})(\d{2})/);
            mobileNumber = "+" + r[1] + ' (' + r[2] + ') ' + r[3] + '-' + r[4] + '-' + r[5]
        }


        const parameters = {
            "mobilephone": mobileNumber,
            "telephone3": aonNumber,
            "phoneCallGUID": formContext.data.entity.getId()
            // "firstname": toLookup.name,  // MDC-529
            // "customerType": toLookup.entityType // MDC-529
        };

        if (toLookup) {
            parameters["customerType"] = toLookup.entityType;
        }

        var contactName = formContext.getAttribute("crmpark_contact_fullname")?.getValue()

        if (contactName) {
            parameters["firstname"] = contactName
        }

        var description = formContext.getAttribute("description")?.getValue()

        if (description) {
            parameters["description"] = description
        }

        //список необязательных полей, котореы принимает действие 
        var parametersFields = [
            "subject",
            "project_isrooms1",
            "project_isrooms2",
            "project_isrooms3",
            "project_isrooms4",
            "project_isgarage",
            "project_iskladovka",
            "project_isuninhabited"
        ];

        for (var parametersField of parametersFields) {
            var fieldValue = formContext.getAttribute(parametersField)?.getValue();
            if (fieldValue) {
                parameters[parametersField] = fieldValue;
            }
        }

        if (toLookup && toLookup.id) {
            var id = toLookup.id.replace('{', '').replace('}', '');
            parameters[`customerid`] = id;
        }

        if (advertisingLead) {
            var id = advertisingLead.id.replace('{', '').replace('}', '');
            parameters["project_advertisingid"] = id;
        }

        //Если в отношении указана застройка
        var regardingLookupList = formContext.getAttribute("regardingobjectid")?.getValue();
        if (regardingLookupList && regardingLookupList.length > 0) {
            var regardingObject = regardingLookupList[0];
            if (regardingObject.entityType == "project_classifier") {
                var id = regardingObject.id.replace('{', '').replace('}', '');
                parameters["project_classifierid"] = id;
            }
        }

        //Загрузить ОН и проверить статус
        var artLookupList = formContext.getAttribute("new_articleid")?.getValue();
        if (artLookupList && artLookupList.length > 0) {
            var art = await Xrm.WebApi.retrieveRecord(
                "project_article",
                artLookupList[0].id.replace('{', '').replace('}', ''),
                "?$select=statuscode,_project_addressid_value"
            );

            artstatus = art["statuscode"];
            if (artstatus !== 4 && artstatus !== 8) {
                var alertStrings = { confirmButtonLabel: "ОК", text: "Новая заявка не может быть создана. Для создания новой Заявки необходимо, чтобы у выбранного Объекта недвижимости был один из статусов «Свободно» ,«Устная бронь» и «Бронь»", title: "Ошибка!" };
                var alertOptions = { height: 260, width: 400 };
                Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                    function (success) {
                        console.log("Alert dialog closed");
                    },
                    function (error) {
                        console.log(error.message);
                    }
                );

                return;
            } else {
                var artId = artLookupList[0].id.replace('{', '').replace('}', '');
                parameters["project_article"] = artId;

                if (art["_project_addressid_value"] != null) {
                    var address = await Xrm.WebApi.retrieveRecord(
                        "project_address",
                        art["_project_addressid_value"].replace('{', '').replace('}', ''),
                        "?$select=statuscode,_project_classifierid_value"
                    );

                    if (address && address._project_classifierid_value) {
                        var clsId = address["_project_classifierid_value"].replace('{', '').replace('}', '');
                        parameters["project_classifierid"] = clsId;
                    }
                }
            }
        }

        try {

            const request = {
                getMetadata: function () {
                    return {
                        boundParameter: null,
                        parameterTypes: {
                            "subject": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "mobilephone": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "telephone3": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "project_isrooms1": {
                                typeName: "Edm.Boolean",
                                structuralProperty: 1
                            },
                            "project_isrooms2": {
                                typeName: "Edm.Boolean",
                                structuralProperty: 1
                            },
                            "project_isrooms3": {
                                typeName: "Edm.Boolean",
                                structuralProperty: 1
                            },
                            "project_isrooms4": {
                                typeName: "Edm.Boolean",
                                structuralProperty: 1
                            },
                            "project_isgarage": {
                                typeName: "Edm.Boolean",
                                structuralProperty: 1
                            },
                            "project_iskladovka": {
                                typeName: "Edm.Boolean",
                                structuralProperty: 1
                            },
                            "project_isuninhabited": {
                                typeName: "Edm.Boolean",
                                structuralProperty: 1
                            },
                            "firstname": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "description": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "customerType": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "customerid": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "project_advertisingid": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "project_classifierid": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "project_article": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "phoneCallGUID": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            }
                        },
                        operationType: 0,
                        operationName: "crmpark_convertPhonecallToLead"
                    };
                },
                ...parameters
            };

            formContext.ui.setFormNotification("Процесс создания Заявки запущен. Пожалуйста, подождите", "INFO", "leadCreate");

            var response = await Xrm.WebApi.online.execute(request);

            if (response.ok) {
                var result = await response.json();
                console.log("Результат действия:", result);

                var leadLookUp = [{
                    id: result.lead.leadid,
                    name: contactName,
                    entityType: "lead"
                }]

                formContext.getAttribute("new_zaauto2").setValue(leadLookUp);

                formContext.data.save().then(function () {

                    //Запускаем каскадное обновление звонков по Заявке
                    Project.Phonecall._setLeadsInLinkedPhonecalls(primaryControl);

                    formContext.data.refresh(false);
                    var guid = result.leadUrl.split("&")[1].replace("id=", '');

                    //Получаем ссылку на текущую запись телефона
                    var globalContext = Xrm.Utility.getGlobalContext();
                    var baseUrl = globalContext.getClientUrl();
                    const recordUrl = `${baseUrl}/main.aspx?etn=lead&id=${guid}&pagetype=entityrecord`;

                    Xrm.Navigation.openForm({
                        entityName: "lead",
                        entityId: guid
                    });
                })
            }

            formContext.ui.clearFormNotification("leadCreate");
        }
        catch (e) {
            console.log(e);
            formContext.ui.clearFormNotification("leadCreate");

            var alertStrings = { confirmButtonLabel: "ОК", text: "При создании заявки возникла ошибка! Обратитесь к системному администратору. Сведения об ошибке: " + e.message, title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );
        }
    },

    // Блок Получение записи для Мегафон
    callActionForURLRecord: async function (link, actionName) {
        try {
            objActionCallRequest = {
                CallDownloadLink: link,
                getMetadata: function () {
                    objMetadata = {
                        boundParameter: null, // Действие запускается на сущности - entity 
                        parameterTypes: {
                            "CallDownloadLink": {
                                typeName: "Edm.String",
                                structuralProperty: 1 // For PrimitiveType
                            }
                        },
                        operationName: actionName,
                        operationType: 0    // 0 is for Calling Action using Xrm.WebApi.execute
                    };
                    return objMetadata;
                }
            };

            //Получение результата
            let data = await Xrm.WebApi.online.execute(objActionCallRequest);
            let res = await data.json();

            return res;
        } catch (ex) {
            console.log("При проверке доступа возникла ошибка. Пожалуйста, обратитесь к Администратору CRM. \r\n Подробности об ошибке: " + ex.message);
        }
    },

    getClientLookupValue: function (formContext) {
        var clientLookup;
        var currentdirection = Project.Common.getValue(formContext, "directioncode");
        if (currentdirection)
            clientLookup = "to";
        else
            clientLookup = "from";
        var clientLookupValue = Project.Common.getValue(formContext, clientLookup);
        if (!clientLookupValue || !clientLookupValue[0])
            return null
        console.log("Ищем значение в поле клиента:  " + JSON.stringify(clientLookupValue));
        return clientLookupValue[0];
    },

    downloadBase64FileToUser: function (formContext, base64, type) {

        var byteCharacters = atob(base64);
        var byteArrays = [];

        for (var offset = 0; offset < byteCharacters.length; offset += 1024) {
            var slice = byteCharacters.slice(offset, offset + 1024);
            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            var byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        var blob = new Blob(byteArrays, { type: type });

        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);

        var phone = Project.Common.getValue(formContext, "phonenumber");
        var clientNameLookup = Project.Phonecall.getClientLookupValue(formContext);
        var phoneName = clientNameLookup != null ? ("_" + clientNameLookup["name"]) : "";

        link.download = phone + phoneName + "_запись_звонка.wav";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    getCurrentIntegration: function (formContext) {
        var integrationCode = Project.Common.getValue(formContext, "crmpark_integrationcode");
        if (integrationCode == Project.Phonecall.Integration.Megafon)
            return "Megafon"
        else
            return "MightyCall"
    },

    downloadCallRecord: async function (primaryControl) {
        var formContext = Project.Common.getFormContext(primaryControl);

        var link = Project.Common.getValue(formContext, "infratel_call_record_url");
        if (link) {
            var currentIntegration = Project.Phonecall.getCurrentIntegration(formContext);
            var fileResult = null;
            switch (currentIntegration) {
                case "MightyCall":
                    fileResult = await Project.Phonecall.callActionForURLRecord(link, "crmpark_GetCallRecordMightyCall");
                    break;
                case "Megafon":
                    fileResult = await Project.Phonecall.callActionForURLRecord(link, "crmpark_GetMegafonCall");
                    break;
            }

            if (fileResult) {
                if (fileResult.Base64) {
                    Project.Phonecall.downloadBase64FileToUser(formContext, fileResult.Base64, "audio/wav")
                } else {
                    var alertStrings = { confirmButtonLabel: "ОК", text: "Возникла ошибка при получении записи разговора: " + fileResult.Message, title: "Ошибка!" };
                    var alertOptions = { height: 260, width: 400 };
                    Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                        function (success) {
                            console.log("Alert dialog closed");
                        },
                        function (error) {
                            console.log(error.message);
                        }
                    );
                    console.log("Возникла ошибка при получении записи разговора: " + fileResult.Message)
                }
            }
        }
        else {
            var alertStrings = { confirmButtonLabel: "ОК", text: "Для данного звонка не указана ссылка на звонок.", title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );
        }
    },

    listenComagicCall: function (primaryControl) {
        var formContext = Project.Common.getFormContext(primaryControl);

        var comagicCallLink = Project.Common.getValue(formContext, "crmpark_comagic_record_link");
        if (typeof comagicCallLink != 'undefined' && comagicCallLink != null && comagicCallLink.length > 1) {
            window.open(comagicCallLink);
        }
        else {
            var alertStrings = { confirmButtonLabel: "ОК", text: "Для данного звонка нет записи", title: "Ошибка!" };
            var alertOptions = { height: 260, width: 400 };
            Xrm.Navigation.openAlertDialog(alertStrings, alertOptions).then(
                function (success) {
                    console.log("Alert dialog closed");
                },
                function (error) {
                    console.log(error.message);
                }
            );
        }
    },

    checkCallRecordButtonVisability: function (context) {

        var formContext = Project.Common.getFormContext(context);
        return Project.Common.getValue(formContext, "infratel_call_record_url") != null ? true : false;
    },

    isListenComagicCallEnabled: function (primaryControl) {

        var formContext = Project.Common.getFormContext(primaryControl);
        return Project.Common.getValue(formContext, "crmpark_comagic_record_link") != null ? true : false;
    },

    //К удалению (неактуальная интеграция с МТС)
    // isListenMtsCallEnabled: function (primaryControl) {
    //     var formContext = Project.Common.getFormContext(primaryControl);
    //     return formContext.getAttribute("crmpark_from_mts").getValue() === true && formContext.getAttribute("crmpark_external_phonecall_url").getValue() != '';
    // },

    // Enable rule карточки клиента
    openCustomerFormEnabled: function (primaryControl) {

        var formContext = Project.Common.getFormContext(primaryControl);

        var toLookupList = formContext.getAttribute("to")?.getValue();
        var fromLookupList = formContext.getAttribute("from")?.getValue();
        var directioncode = formContext.getAttribute("directioncode");

        if (!directioncode) return false;
        var isOutgoingPhonecall = directioncode.getValue();
        return (isOutgoingPhonecall && toLookupList && toLookupList.length > 0) ||
            (!isOutgoingPhonecall && fromLookupList && fromLookupList.length > 0);
    },

    configureCallCenterFormAutosave: function (executionContext) {
        formContext = executionContext.getFormContext();

        try {
            Project.Phonecall.operatorCallCenter.requiredFields.forEach(function (field) {
                formContext.getAttribute(field).addOnChange(function () {
                    Project.Phonecall.checkIfRequiredFieldsAreFilled(executionContext);
                });
            });
        }
        catch (ex) {
            console.error("Во время автосохранения формы \"Оператор КЦ\" произошла следующая ошибка: " + ex);
        }
    },

    checkIfRequiredFieldsAreFilled: function (executionContext) {
        formContext = executionContext.getFormContext();
        var requiredFieldName;
        var fieldObject;
        var fieldValue;

        for (var i = 0; i < Project.Phonecall.operatorCallCenter.requiredFields.length; i++) {
            requiredFieldName = Project.Phonecall.operatorCallCenter.requiredFields[i];
            fieldObject = formContext.getAttribute(requiredFieldName);
            if (!fieldObject) {
                console.error("Неправильно настроена проверка полей на заполнение: поле " + requiredFieldName + "отсутствует на форме");
                return;
            }
            fieldValue = fieldObject.getValue();
            if (fieldValue == null) return; //Выходим т.к. не все поля заполнены
        }
        formContext.data.refresh(true);
    },

    addOnChangeIfFieldExists: function (formContext, attributeName, handler) {
        var attribute = formContext.getAttribute(attributeName);
        if (attribute) {
            attribute.addOnChange(handler);
        }
    },

    checkAndGetMOP: async function (executionContext) {

        formContext = executionContext.getFormContext();
        var directionCodeValue = formContext.getAttribute("directioncode")?.getValue();
        if (typeof directionCodeValue !== 'boolean') {
            return; //Выходим, т.к. не можем определить физ. лицо
        }

        //true - исходящий, false - входящий
        var clientLookupValue = formContext.getAttribute(directionCodeValue ? "to" : "from")?.getValue()?.[0];
        var factProjectValue = formContext.getAttribute("crmpark_classifierid")?.getValue()?.[0];

        if (clientLookupValue && factProjectValue) {

            var getMOPRequest = {
                contactGuid: clientLookupValue.id,
                projectGuid: factProjectValue.id,
                getMetadata: function () {
                    objMetadata = {
                        boundParameter: null,
                        parameterTypes: {
                            "contactGuid": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            },
                            "projectGuid": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            }
                        },
                        operationName: "crmpark_ExecuteFindMOPOnProjectAndContact",
                        operationType: 0
                    };
                    return objMetadata;
                }
            };
            var result = await Xrm.WebApi.online.execute(getMOPRequest);
            if (result.ok) {
                var resultBody = await result.json();
                resultMOP = JSON.parse(resultBody.jsonResult);
                if (resultMOP.MOPName && resultMOP.MOPId) {
                    var MOPLookup = new Array();
                    MOPLookup[0] = {
                        id: resultMOP.MOPId,
                        name: resultMOP.MOPName,
                        entityType: "systemuser"
                    };
                    formContext.getAttribute("crmpark_owner_managerid").setValue(MOPLookup);
                    console.log("МОП заполнен")
                }
            } else {
                console.error("При попытке получить МОПа произошла следующая ошибка: " + JSON.stringify(result));
            }
        }
    },

    _setLeadsInLinkedPhonecalls: async function (primaryControl) {
        var formContext = Project.Common.getFormContext(primaryControl);

        try {
            const request = {
                entity: {
                    entityType: "phonecall",
                    id: formContext.data.entity.getId().replace(/[{}]/g, "") //убираем {} из GUID'а
                },
                getMetadata: function () {
                    return {
                        boundParameter: "entity",
                        operationType: 0,
                        operationName: "crmpark_updateLeadsOnLinkedCallsAsAdmin",
                        parameterTypes: {
                            entity: {
                                typeName: "Microsoft.Dynamics.CRM.phonecall",
                                structuralProperty: 5
                            }
                        }
                    };
                }
            };

            const result = await Xrm.WebApi.online.execute(request);
            if (result.ok) {
                console.log("Process completed successfully.");
            } else {
                console.error("Action did not complete successfully", result);
            }
        } catch (error) {
            console.error("Error:", JSON.stringify(error));
        }

    }

};


Project.Phonecall.Ribbon = {
    onDownloadCallRecordButtonClick: async function (primaryControl) {
        await Project.Phonecall.downloadCallRecord(primaryControl);
    },

    onListenComagicCallButtonClick: function (primaryControl) {
        Project.Phonecall.listenComagicCall(primaryControl);
    },

    //К удалению (неактуальная интеграция с МТС)
    // onListenMtsCallButtonClick: async function (primaryControl) {
    //     await Project.Phonecall.listenMtsCall(primaryControl);
    // },

    //Обработчик клика кнопки "Карточка Клиента"
    onOpenCustomerFormButtonClick: function (primaryControl) {
        Project.Phonecall.openCustomerForm(primaryControl);
    },

    onConvertToLeadButtonClick: async function (primaryControl) {
        await Project.Phonecall.convertToLead(primaryControl);
    },

    isDownloadCallRecordButtonEnabled: function (primaryControl) {
        return Project.Phonecall.checkCallRecordButtonVisability(primaryControl);
    },

    isListenComagicCallEnabled: function (primaryControl) {
        return Project.Phonecall.isListenComagicCallEnabled(primaryControl);
    },

    //К удалению (неактуальная интеграция с МТС)
    // isListenMtsCallEnabled: function (primaryControl) {
    //     return Project.Phonecall.isListenMtsCallEnabled(primaryControl);
    // },

    // Enable rule карточки клиента
    openCustomerFormEnabled: function (primaryControl) {
        return Project.Phonecall.openCustomerFormEnabled(primaryControl);
    }
}

Project.Phonecall.Integration = {
    Megafon: 557180000,
    CoMagic: 557180001,
    MTS: 557180002,
    Nothing: 557180003
}