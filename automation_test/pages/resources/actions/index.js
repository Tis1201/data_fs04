const navigationActions = require('./navigation-actions');
const listingActions = require('./listing-actions');
const listingModalActions = require('./listing-modal-actions');

module.exports = {
    navigationActions,
    listingActions,
    listingModalActions,
    all: Object.assign({}, navigationActions, listingActions, listingModalActions),
};
