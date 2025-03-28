const cleanRevokedTokens = require('./revokedTokens/cleanRevokedTokens');
const cleanBookings = require('./bookings/cleanBookings');
const cleanInactiveBookings = require('./bookings/cleanInactiveBookings');

module.exports = { cleanRevokedTokens, cleanBookings, cleanInactiveBookings };
