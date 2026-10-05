// The booking terms the guest accepts before paying (B-13, IDEN-01). The text is the owner's and does not exist yet:
// until he supplies it the page shows [Booking terms] and live payments stay off (the hold route refuses a live Stripe
// key while BOOKING_TERMS_IS_PLACEHOLDER is true). His text replaces [Booking terms]; both constants change in the
// same commit: the version names the text the guest agreed to and is stored on the booking.

export const BOOKING_TERMS_VERSION = "placeholder";
export const BOOKING_TERMS_IS_PLACEHOLDER = true;
