import * as path from 'path';
import { Library, Session, IDialogResult, Prompts, ListStyle } from 'botbuilder';
import * as common from './common';
import { Strings, LibraryName } from './consts';
import { Place } from './place';
import * as defaultLocationDialog from './dialogs/default-location-dialog';
import * as facebookLocationDialog from './dialogs/facebook-location-dialog'
import * as requiredFieldsDialog from './dialogs/required-fields-dialog';
import * as addFavoriteLocationDialog from './dialogs/add-favorite-location-dialog';

export interface ILocationPromptOptions {
    prompt: string;
    requiredFields?: requiredFieldsDialog.LocationRequiredFields;
    useNativeControl?: boolean,
    reverseGeocode?: boolean
}

exports.LocationRequiredFields = requiredFieldsDialog.LocationRequiredFields;
exports.getFormattedAddressFromPlace = common.getFormattedAddressFromPlace;
exports.Place = Place;

//=========================================================
// Library creation
//=========================================================


exports.createLibrary = (apiKey: string): Library => {
    if (typeof apiKey === "undefined") {
        throw "'apiKey' parameter missing";
    }

    var lib = new Library(LibraryName);

    requiredFieldsDialog.register(lib);
    defaultLocationDialog.register(lib, apiKey);
    facebookLocationDialog.register(lib, apiKey);
    addFavoriteLocationDialog.register(lib);
    lib.localePath(path.join(__dirname, 'locale/'));

    lib.dialog('locationPickerPrompt', getLocationPickerPrompt());

    return lib;
}

//=========================================================
// Location Picker Prompt
//=========================================================

exports.getLocation = function (session: Session, options: ILocationPromptOptions): Session {
    options = options || { prompt: session.gettext(Strings.DefaultPrompt) };
    if (typeof options.prompt == "undefined") {
        options.prompt = session.gettext(Strings.DefaultPrompt);
    }

    return session.beginDialog(LibraryName + ':locationPickerPrompt', options);
};

function getLocationPickerPrompt() {
    return [
        // retrieve the location
        (session: Session, args: ILocationPromptOptions) => {
            session.dialogData.args = args;
            if (args.useNativeControl && session.message.address.channelId == 'facebook') {
                session.beginDialog('facebook-location-dialog', args);
            }
            else {
                session.beginDialog('default-location-dialog', args);
            }
        },
        // complete required fields, if applicable
        (session: Session, results: IDialogResult<any>, next: (results?: IDialogResult<any>) => void) => {
            if (results.response && results.response.place) {
                session.beginDialog('required-fields-dialog', {
                    place: results.response.place,
                    requiredFields: session.dialogData.args.requiredFields
                })
            } else {
                next(results);
            }
        },
        // make final confirmation
        (session: Session, results: IDialogResult<any>, next: (results?: IDialogResult<any>) => void) => {
            if (results.response && results.response.place) {
                var separator = session.gettext(Strings.AddressSeparator);
                var promptText = session.gettext(Strings.ConfirmationAsk, common.getFormattedAddressFromPlace(results.response.place, separator));
                session.dialogData.place = results.response.place;
                Prompts.confirm(session, promptText, { listStyle: ListStyle.none })
            } else {
                next(results);
            }
        },
        // offer add to favorites, if applicable
        (session: Session, results: IDialogResult<any>, next: (results?: IDialogResult<any>) => void) => {
            if(!session.dialogData.args.skipFavorites && results.response && !results.response.reset) {
                session.beginDialog('add-favorite-location-dialog', { place : session.dialogData.place });
            }
            else {
                 next(results);
            }
        },
        (session: Session, results: IDialogResult<any>, next: (results?: IDialogResult<any>) => void) => {
            if (results.response && results.response.reset) {
                session.send(Strings.ResetPrompt)
                session.replaceDialog('locationPickerPrompt', session.dialogData.args);
            }
            else {
                next({ response: session.dialogData.place });
            }
        }
    ];
}