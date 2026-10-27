
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "auth_confirm_attempts": {
                  Row: {
                    "created_at": string,"id": number,"ip_key": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"ip_key": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"ip_key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"auth_link_requests": {
                  Row: {
                    "created_at": string,"email_hash": string,"id": number,"ip_hash": string
                  }
                  Insert: {
                    "created_at"?: string,"email_hash": string,"id"?: never,"ip_hash": string
                  }
                  Update: {
                    "created_at"?: string,"email_hash"?: string,"id"?: never,"ip_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"availability_blocks": {
                  Row: {
                    "created_at": string,"created_by": string | null,"destination_id": string | null,"ends_on": string,"id": string,"reason": string | null,"scope": string,"starts_on": string,"stay_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"destination_id"?: string | null,"ends_on": string,"id"?: string,"reason"?: string | null,"scope": string,"starts_on": string,"stay_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"destination_id"?: string | null,"ends_on"?: string,"id"?: string,"reason"?: string | null,"scope"?: string,"starts_on"?: string,"stay_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_blocks_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "api_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "availability_blocks_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "availability_blocks_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "availability_blocks_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_bank_details": {
                  Row: {
                    "account_name": string | null,"bank_address": string | null,"bank_name": string | null,"iban": string | null,"id": number,"note_ar": string | null,"note_en": string | null,"note_es": string | null,"swift": string | null,"transfer_window_minutes": number | null,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "account_name"?: string | null,"bank_address"?: string | null,"bank_name"?: string | null,"iban"?: string | null,"id"?: number,"note_ar"?: string | null,"note_en"?: string | null,"note_es"?: string | null,"swift"?: string | null,"transfer_window_minutes"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "account_name"?: string | null,"bank_address"?: string | null,"bank_name"?: string | null,"iban"?: string | null,"id"?: number,"note_ar"?: string | null,"note_en"?: string | null,"note_es"?: string | null,"swift"?: string | null,"transfer_window_minutes"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"booking_disputes": {
                  Row: {
                    "amount_fils": number | null,"booking_id": string,"charge_id": string | null,"created_at": string,"id": number,"payment_id": string | null,"reason": string | null,"status": string | null,"stripe_dispute_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_fils"?: number | null,"booking_id": string,"charge_id"?: string | null,"created_at"?: string,"id"?: never,"payment_id"?: string | null,"reason"?: string | null,"status"?: string | null,"stripe_dispute_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_fils"?: number | null,"booking_id"?: string,"charge_id"?: string | null,"created_at"?: string,"id"?: never,"payment_id"?: string | null,"reason"?: string | null,"status"?: string | null,"stripe_dispute_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_disputes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_disputes_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "booking_payments"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_events": {
                  Row: {
                    "action": string,"actor": string,"at": string,"booking_id": string,"detail": NonNullable<Json>,"from_status": string | null,"id": number,"to_status": string | null
                  }
                  Insert: {
                    "action": string,"actor": string,"at"?: string,"booking_id": string,"detail"?: NonNullable<Json>,"from_status"?: string | null,"id"?: never,"to_status"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor"?: string,"at"?: string,"booking_id"?: string,"detail"?: NonNullable<Json>,"from_status"?: string | null,"id"?: never,"to_status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_hold_requests": {
                  Row: {
                    "created_at": string,"email_hash": string,"id": number,"ip_hash": string
                  }
                  Insert: {
                    "created_at"?: string,"email_hash": string,"id"?: never,"ip_hash": string
                  }
                  Update: {
                    "created_at"?: string,"email_hash"?: string,"id"?: never,"ip_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"booking_lines": {
                  Row: {
                    "booking_id": string,"catalog_item_id": string,"id": string,"is_uae": boolean,"kind": string,"line_fils": number,"name": string,"quantity": number,"unit": string,"unit_price_fils": number
                  }
                  Insert: {
                    "booking_id": string,"catalog_item_id": string,"id"?: string,"is_uae": boolean,"kind"?: string,"line_fils": number,"name": string,"quantity": number,"unit": string,"unit_price_fils": number
                  }
                  Update: {
                    "booking_id"?: string,"catalog_item_id"?: string,"id"?: string,"is_uae"?: boolean,"kind"?: string,"line_fils"?: number,"name"?: string,"quantity"?: number,"unit"?: string,"unit_price_fils"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_lines_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_lines_catalog_item_id_fkey"
      columns: ["catalog_item_id"]
isOneToOne: false
      referencedRelation: "api_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_lines_catalog_item_id_fkey"
      columns: ["catalog_item_id"]
isOneToOne: false
      referencedRelation: "catalog_items"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_money_settings_log": {
                  Row: {
                    "actor": string,"at": string,"changed": (string)[],"id": number
                  }
                  Insert: {
                    "actor": string,"at"?: string,"changed": (string)[],"id"?: never
                  }
                  Update: {
                    "actor"?: string,"at"?: string,"changed"?: (string)[],"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"booking_nights": {
                  Row: {
                    "booking_id": string,"expires_at": string | null,"night": string,"stay_id": string
                  }
                  Insert: {
                    "booking_id": string,"expires_at"?: string | null,"night": string,"stay_id": string
                  }
                  Update: {
                    "booking_id"?: string,"expires_at"?: string | null,"night"?: string,"stay_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_nights_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_nights_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_nights_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_notes": {
                  Row: {
                    "actor": string,"at": string,"body": string,"booking_id": string,"id": number,"request_id": string | null
                  }
                  Insert: {
                    "actor": string,"at"?: string,"body": string,"booking_id": string,"id"?: never,"request_id"?: string | null
                  }
                  Update: {
                    "actor"?: string,"at"?: string,"body"?: string,"booking_id"?: string,"id"?: never,"request_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_notes_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_payments": {
                  Row: {
                    "amount_fils": number,"bank_reference": string | null,"booking_id": string,"card_brand": string | null,"card_last4": string | null,"charge_id": string | null,"checkout_session_id": string | null,"created_at": string,"currency": string,"id": string,"kind": string,"method": string,"paid_at": string | null,"payment_intent_id": string | null,"presentment_amount": number | null,"presentment_currency": string | null,"received_on": string | null,"recorded_by": string | null,"request_id": string | null,"status": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null,"wallet": string | null,"write_off_fils": number,"write_off_reason": string | null
                  }
                  Insert: {
                    "amount_fils": number,"bank_reference"?: string | null,"booking_id": string,"card_brand"?: string | null,"card_last4"?: string | null,"charge_id"?: string | null,"checkout_session_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"kind": string,"method"?: string,"paid_at"?: string | null,"payment_intent_id"?: string | null,"presentment_amount"?: number | null,"presentment_currency"?: string | null,"received_on"?: string | null,"recorded_by"?: string | null,"request_id"?: string | null,"status"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null,"wallet"?: string | null,"write_off_fils"?: number,"write_off_reason"?: string | null
                  }
                  Update: {
                    "amount_fils"?: number,"bank_reference"?: string | null,"booking_id"?: string,"card_brand"?: string | null,"card_last4"?: string | null,"charge_id"?: string | null,"checkout_session_id"?: string | null,"created_at"?: string,"currency"?: string,"id"?: string,"kind"?: string,"method"?: string,"paid_at"?: string | null,"payment_intent_id"?: string | null,"presentment_amount"?: number | null,"presentment_currency"?: string | null,"received_on"?: string | null,"recorded_by"?: string | null,"request_id"?: string | null,"status"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null,"wallet"?: string | null,"write_off_fils"?: number,"write_off_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_payments_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_refunds": {
                  Row: {
                    "amount_fils": number | null,"booking_id": string,"charge_id": string | null,"created_at": string,"id": number,"payment_id": string | null,"status": string | null,"stripe_refund_id": string
                  }
                  Insert: {
                    "amount_fils"?: number | null,"booking_id": string,"charge_id"?: string | null,"created_at"?: string,"id"?: never,"payment_id"?: string | null,"status"?: string | null,"stripe_refund_id": string
                  }
                  Update: {
                    "amount_fils"?: number | null,"booking_id"?: string,"charge_id"?: string | null,"created_at"?: string,"id"?: never,"payment_id"?: string | null,"status"?: string | null,"stripe_refund_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_refunds_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_refunds_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "booking_payments"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_travellers": {
                  Row: {
                    "age": number | null,"booking_id": string,"full_name": string,"is_booker": boolean,"kind": string,"not_staying": boolean,"position": number
                  }
                  Insert: {
                    "age"?: number | null,"booking_id": string,"full_name": string,"is_booker"?: boolean,"kind": string,"not_staying"?: boolean,"position": number
                  }
                  Update: {
                    "age"?: number | null,"booking_id"?: string,"full_name"?: string,"is_booker"?: boolean,"kind"?: string,"not_staying"?: boolean,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_travellers_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "addons_fils": number,"adults": number,"airport": string | null,"arrive": string,"attention_reason": string | null,"balance_due_date": string | null,"balance_due_days": number | null,"balance_fils": number,"children": number,"created_at": string,"created_by": string | null,"currency": string,"deposit_bp": number,"deposit_fils": number,"destination_id": string,"email": string,"emergency_name": string | null,"emergency_phone": string | null,"grand_fils": number,"guest_name": string,"hold_expires_at": string | null,"id": string,"infants": number,"is_test": boolean,"lapse_email_attempts": number,"lapse_email_claimed_at": string | null,"lapse_email_sent_at": string | null,"leave": string,"link_version": number,"locale": string,"nationality": string | null,"needs_attention": boolean,"nights_fils": number,"nights_snapshot": NonNullable<Json>,"ops_request_id": string | null,"paid_fils": number,"phone": string,"pickup_address": string | null,"plan": string,"ref": string,"requested_at": string | null,"source": string,"special_requests": string | null,"status": string,"stay_id": string,"subtotal_fils": number,"terms_accepted_at": string | null,"terms_version": string | null,"updated_at": string,"vat_bp": number,"vat_fils": number,"written_off_fils": number
                  }
                  Insert: {
                    "addons_fils": number,"adults": number,"airport"?: string | null,"arrive": string,"attention_reason"?: string | null,"balance_due_date"?: string | null,"balance_due_days"?: number | null,"balance_fils": number,"children"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deposit_bp": number,"deposit_fils": number,"destination_id": string,"email": string,"emergency_name"?: string | null,"emergency_phone"?: string | null,"grand_fils": number,"guest_name": string,"hold_expires_at"?: string | null,"id"?: string,"infants"?: number,"is_test"?: boolean,"lapse_email_attempts"?: number,"lapse_email_claimed_at"?: string | null,"lapse_email_sent_at"?: string | null,"leave": string,"link_version"?: number,"locale": string,"nationality"?: string | null,"needs_attention"?: boolean,"nights_fils": number,"nights_snapshot": NonNullable<Json>,"ops_request_id"?: string | null,"paid_fils"?: number,"phone": string,"pickup_address"?: string | null,"plan": string,"ref": string,"requested_at"?: string | null,"source": string,"special_requests"?: string | null,"status": string,"stay_id": string,"subtotal_fils": number,"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string,"vat_bp": number,"vat_fils": number,"written_off_fils"?: number
                  }
                  Update: {
                    "addons_fils"?: number,"adults"?: number,"airport"?: string | null,"arrive"?: string,"attention_reason"?: string | null,"balance_due_date"?: string | null,"balance_due_days"?: number | null,"balance_fils"?: number,"children"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deposit_bp"?: number,"deposit_fils"?: number,"destination_id"?: string,"email"?: string,"emergency_name"?: string | null,"emergency_phone"?: string | null,"grand_fils"?: number,"guest_name"?: string,"hold_expires_at"?: string | null,"id"?: string,"infants"?: number,"is_test"?: boolean,"lapse_email_attempts"?: number,"lapse_email_claimed_at"?: string | null,"lapse_email_sent_at"?: string | null,"leave"?: string,"link_version"?: number,"locale"?: string,"nationality"?: string | null,"needs_attention"?: boolean,"nights_fils"?: number,"nights_snapshot"?: NonNullable<Json>,"ops_request_id"?: string | null,"paid_fils"?: number,"phone"?: string,"pickup_address"?: string | null,"plan"?: string,"ref"?: string,"requested_at"?: string | null,"source"?: string,"special_requests"?: string | null,"status"?: string,"stay_id"?: string,"subtotal_fils"?: number,"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string,"vat_bp"?: number,"vat_fils"?: number,"written_off_fils"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "api_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_item_destinations": {
                  Row: {
                    "destination_id": string,"item_id": string
                  }
                  Insert: {
                    "destination_id": string,"item_id": string
                  }
                  Update: {
                    "destination_id"?: string,"item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_item_destinations_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "api_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_item_destinations_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_item_destinations_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "api_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_item_destinations_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "catalog_items"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_item_stays": {
                  Row: {
                    "item_id": string,"position": number,"stay_id": string
                  }
                  Insert: {
                    "item_id": string,"position": number,"stay_id": string
                  }
                  Update: {
                    "item_id"?: string,"position"?: number,"stay_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_item_stays_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "api_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_item_stays_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "catalog_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_item_stays_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_item_stays_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_items": {
                  Row: {
                    "created_at": string,"id": string,"is_home_pickup": boolean,"is_published": boolean,"is_sample": boolean,"is_uae": boolean,"kind": string,"media_id": string | null,"position": number,"price_aed": number | null,"sample_fields": (string)[],"slug": string,"unit": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_home_pickup"?: boolean,"is_published"?: boolean,"is_sample"?: boolean,"is_uae"?: boolean,"kind": string,"media_id"?: string | null,"position"?: number,"price_aed"?: number | null,"sample_fields"?: (string)[],"slug": string,"unit": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_home_pickup"?: boolean,"is_published"?: boolean,"is_sample"?: boolean,"is_uae"?: boolean,"kind"?: string,"media_id"?: string | null,"position"?: number,"price_aed"?: number | null,"sample_fields"?: (string)[],"slug"?: string,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_items_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_translations": {
                  Row: {
                    "duration_label": string | null,"item_id": string,"locale": string,"name": string,"status": string,"summary": string | null,"updated_at": string
                  }
                  Insert: {
                    "duration_label"?: string | null,"item_id": string,"locale": string,"name": string,"status"?: string,"summary"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "duration_label"?: string | null,"item_id"?: string,"locale"?: string,"name"?: string,"status"?: string,"summary"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_translations_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "api_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_translations_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "catalog_items"
      referencedColumns: ["id"]
    }
                  ]
                },"destination_translations": {
                  Row: {
                    "destination_id": string,"locale": string,"name": string,"nights_label": string | null,"region": string | null,"short_line": string | null,"status": string,"summary": string | null,"updated_at": string
                  }
                  Insert: {
                    "destination_id": string,"locale": string,"name": string,"nights_label"?: string | null,"region"?: string | null,"short_line"?: string | null,"status"?: string,"summary"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "destination_id"?: string,"locale"?: string,"name"?: string,"nights_label"?: string | null,"region"?: string | null,"short_line"?: string | null,"status"?: string,"summary"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "destination_translations_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "api_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "destination_translations_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    }
                  ]
                },"destinations": {
                  Row: {
                    "created_at": string,"hero_media_id": string | null,"id": string,"inset_media_id": string | null,"is_published": boolean,"is_sample": boolean,"position": number,"sample_fields": (string)[],"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"hero_media_id"?: string | null,"id"?: string,"inset_media_id"?: string | null,"is_published"?: boolean,"is_sample"?: boolean,"position"?: number,"sample_fields"?: (string)[],"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"hero_media_id"?: string | null,"id"?: string,"inset_media_id"?: string | null,"is_published"?: boolean,"is_sample"?: boolean,"position"?: number,"sample_fields"?: (string)[],"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "destinations_hero_media_id_fkey"
      columns: ["hero_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "destinations_inset_media_id_fkey"
      columns: ["inset_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"host_handoff": {
                  Row: {
                    "expires_at": string,"token_hash": string,"used_at": string | null,"user_id": string
                  }
                  Insert: {
                    "expires_at": string,"token_hash": string,"used_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"token_hash"?: string,"used_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"image_translations": {
                  Row: {
                    "alt": string,"image_id": string,"locale": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "alt": string,"image_id": string,"locale": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "alt"?: string,"image_id"?: string,"locale"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "image_translations_image_id_fkey"
      columns: ["image_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"inclusion_translations": {
                  Row: {
                    "inclusion_id": string,"label": string,"locale": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "inclusion_id": string,"label": string,"locale": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "inclusion_id"?: string,"label"?: string,"locale"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inclusion_translations_inclusion_id_fkey"
      columns: ["inclusion_id"]
isOneToOne: false
      referencedRelation: "inclusions"
      referencedColumns: ["id"]
    }
                  ]
                },"inclusions": {
                  Row: {
                    "created_at": string,"id": string,"is_published": boolean,"position": number,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_published"?: boolean,"position": number,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_published"?: boolean,"position"?: number,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"journey_tier_translations": {
                  Row: {
                    "body": string | null,"duration_label": string | null,"ideal_for": string | null,"ideal_for_label": string | null,"locale": string,"name": string,"price_label": string,"status": string,"tagline": string | null,"tier_id": string,"updated_at": string
                  }
                  Insert: {
                    "body"?: string | null,"duration_label"?: string | null,"ideal_for"?: string | null,"ideal_for_label"?: string | null,"locale": string,"name": string,"price_label": string,"status"?: string,"tagline"?: string | null,"tier_id": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"duration_label"?: string | null,"ideal_for"?: string | null,"ideal_for_label"?: string | null,"locale"?: string,"name"?: string,"price_label"?: string,"status"?: string,"tagline"?: string | null,"tier_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journey_tier_translations_tier_id_fkey"
      columns: ["tier_id"]
isOneToOne: false
      referencedRelation: "api_journey_tiers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journey_tier_translations_tier_id_fkey"
      columns: ["tier_id"]
isOneToOne: false
      referencedRelation: "journey_tiers"
      referencedColumns: ["id"]
    }
                  ]
                },"journey_tiers": {
                  Row: {
                    "created_at": string,"est_high": number | null,"est_low": number | null,"est_open_ended": boolean | null,"id": string,"is_featured": boolean,"is_published": boolean,"is_sample": boolean,"media_id": string | null,"position": number,"price_from_amount": number | null,"price_from_currency": string | null,"sample_fields": (string)[],"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"est_high"?: number | null,"est_low"?: number | null,"est_open_ended"?: boolean | null,"id"?: string,"is_featured"?: boolean,"is_published"?: boolean,"is_sample"?: boolean,"media_id"?: string | null,"position"?: number,"price_from_amount"?: number | null,"price_from_currency"?: string | null,"sample_fields"?: (string)[],"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"est_high"?: number | null,"est_low"?: number | null,"est_open_ended"?: boolean | null,"id"?: string,"is_featured"?: boolean,"is_published"?: boolean,"is_sample"?: boolean,"media_id"?: string | null,"position"?: number,"price_from_amount"?: number | null,"price_from_currency"?: string | null,"sample_fields"?: (string)[],"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journey_tiers_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"media": {
                  Row: {
                    "bytes": number | null,"content_type": string | null,"created_at": string,"height": number | null,"id": string,"key": string,"sha256": string | null,"source": string,"width": number | null
                  }
                  Insert: {
                    "bytes"?: number | null,"content_type"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"key": string,"sha256"?: string | null,"source"?: string,"width"?: number | null
                  }
                  Update: {
                    "bytes"?: number | null,"content_type"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"key"?: string,"sha256"?: string | null,"source"?: string,"width"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"currency": string,"email": string,"first_name": string | null,"id": string,"last_name": string | null,"locale": string,"phone": string | null,"role": string
                  }
                  Insert: {
                    "created_at"?: string,"currency"?: string,"email": string,"first_name"?: string | null,"id": string,"last_name"?: string | null,"locale"?: string,"phone"?: string | null,"role"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"email"?: string,"first_name"?: string | null,"id"?: string,"last_name"?: string | null,"locale"?: string,"phone"?: string | null,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"site_publish": {
                  Row: {
                    "id": number,"last_build_uuid": string | null,"last_hook_at": string | null,"last_hook_result": string | null,"requested_at": string | null,"requested_seq": number
                  }
                  Insert: {
                    "id"?: number,"last_build_uuid"?: string | null,"last_hook_at"?: string | null,"last_hook_result"?: string | null,"requested_at"?: string | null,"requested_seq"?: number
                  }
                  Update: {
                    "id"?: number,"last_build_uuid"?: string | null,"last_hook_at"?: string | null,"last_hook_result"?: string | null,"requested_at"?: string | null,"requested_seq"?: number
                  }
                  Relationships: [
                    
                  ]
                },"site_settings": {
                  Row: {
                    "balance_due_days": number | null,"body_face": string | null,"charcoal": string | null,"deposit_percent": number | null,"gold": string | null,"id": number,"ivory": string | null,"logo_media_id": string | null,"maintenance": boolean,"teal": string | null,"title_face": string | null,"vat_percent": number | null,"white": string | null
                  }
                  Insert: {
                    "balance_due_days"?: number | null,"body_face"?: string | null,"charcoal"?: string | null,"deposit_percent"?: number | null,"gold"?: string | null,"id"?: number,"ivory"?: string | null,"logo_media_id"?: string | null,"maintenance"?: boolean,"teal"?: string | null,"title_face"?: string | null,"vat_percent"?: number | null,"white"?: string | null
                  }
                  Update: {
                    "balance_due_days"?: number | null,"body_face"?: string | null,"charcoal"?: string | null,"deposit_percent"?: number | null,"gold"?: string | null,"id"?: number,"ivory"?: string | null,"logo_media_id"?: string | null,"maintenance"?: boolean,"teal"?: string | null,"title_face"?: string | null,"vat_percent"?: number | null,"white"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "site_settings_logo_media_id_fkey"
      columns: ["logo_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"stay_access": {
                  Row: {
                    "address": string | null,"door_code": string | null,"notes": string | null,"notes_ar": string | null,"notes_es": string | null,"stay_id": string,"updated_at": string,"wifi_name": string | null,"wifi_password": string | null
                  }
                  Insert: {
                    "address"?: string | null,"door_code"?: string | null,"notes"?: string | null,"notes_ar"?: string | null,"notes_es"?: string | null,"stay_id": string,"updated_at"?: string,"wifi_name"?: string | null,"wifi_password"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"door_code"?: string | null,"notes"?: string | null,"notes_ar"?: string | null,"notes_es"?: string | null,"stay_id"?: string,"updated_at"?: string,"wifi_name"?: string | null,"wifi_password"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stay_access_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: true
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stay_access_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: true
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"stay_gallery": {
                  Row: {
                    "media_id": string,"position": number,"stay_id": string
                  }
                  Insert: {
                    "media_id": string,"position": number,"stay_id": string
                  }
                  Update: {
                    "media_id"?: string,"position"?: number,"stay_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stay_gallery_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stay_gallery_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stay_gallery_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"stay_rates": {
                  Row: {
                    "created_at": string,"id": string,"nightly_rate_aed": number,"nights": unknown,"span_days": number | null,"stay_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"nightly_rate_aed": number,"nights": unknown,"span_days"?: never,"stay_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"nightly_rate_aed"?: number,"nights"?: unknown,"span_days"?: never,"stay_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stay_rates_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stay_rates_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"stay_translations": {
                  Row: {
                    "amenities": (string)[],"bathrooms_label": string | null,"beds_label": string | null,"description": (string)[],"guests_label": string | null,"inclusions": (string)[],"locale": string,"neighborhood": string | null,"policy_headings": (string)[],"price_label": string | null,"price_note": string | null,"status": string,"stay_id": string,"tagline": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "amenities"?: (string)[],"bathrooms_label"?: string | null,"beds_label"?: string | null,"description"?: (string)[],"guests_label"?: string | null,"inclusions"?: (string)[],"locale": string,"neighborhood"?: string | null,"policy_headings"?: (string)[],"price_label"?: string | null,"price_note"?: string | null,"status"?: string,"stay_id": string,"tagline"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "amenities"?: (string)[],"bathrooms_label"?: string | null,"beds_label"?: string | null,"description"?: (string)[],"guests_label"?: string | null,"inclusions"?: (string)[],"locale"?: string,"neighborhood"?: string | null,"policy_headings"?: (string)[],"price_label"?: string | null,"price_note"?: string | null,"status"?: string,"stay_id"?: string,"tagline"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stay_translations_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stay_translations_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"stays": {
                  Row: {
                    "base_nightly_rate_aed": number | null,"bathrooms": number | null,"bedrooms": number | null,"created_at": string,"destination_id": string,"hero_media_id": string | null,"id": string,"infants_count": boolean | null,"is_published": boolean,"is_sample": boolean,"max_guests": number | null,"min_guests": number | null,"min_nights": number,"pets_fee_aed": number | null,"pets_rule": string | null,"position": number,"sample_fields": (string)[],"slug": string,"updated_at": string
                  }
                  Insert: {
                    "base_nightly_rate_aed"?: number | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"created_at"?: string,"destination_id": string,"hero_media_id"?: string | null,"id"?: string,"infants_count"?: boolean | null,"is_published"?: boolean,"is_sample"?: boolean,"max_guests"?: number | null,"min_guests"?: number | null,"min_nights"?: number,"pets_fee_aed"?: number | null,"pets_rule"?: string | null,"position"?: number,"sample_fields"?: (string)[],"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "base_nightly_rate_aed"?: number | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"created_at"?: string,"destination_id"?: string,"hero_media_id"?: string | null,"id"?: string,"infants_count"?: boolean | null,"is_published"?: boolean,"is_sample"?: boolean,"max_guests"?: number | null,"min_guests"?: number | null,"min_nights"?: number,"pets_fee_aed"?: number | null,"pets_rule"?: string | null,"position"?: number,"sample_fields"?: (string)[],"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stays_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "api_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stays_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stays_hero_media_id_fkey"
      columns: ["hero_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_events": {
                  Row: {
                    "claimed_at": string,"id": string,"processed_at": string | null,"received_at": string,"type": string | null
                  }
                  Insert: {
                    "claimed_at"?: string,"id": string,"processed_at"?: string | null,"received_at"?: string,"type"?: string | null
                  }
                  Update: {
                    "claimed_at"?: string,"id"?: string,"processed_at"?: string | null,"received_at"?: string,"type"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"team_member_translations": {
                  Row: {
                    "bio": string | null,"locale": string,"member_id": string,"name": string,"role": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "bio"?: string | null,"locale": string,"member_id": string,"name": string,"role"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "bio"?: string | null,"locale"?: string,"member_id"?: string,"name"?: string,"role"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_member_translations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "api_team"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_member_translations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"is_published": boolean,"is_sample": boolean,"links": NonNullable<Json>,"photo_media_id": string | null,"position": number,"sample_fields": (string)[],"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"is_published"?: boolean,"is_sample"?: boolean,"links"?: NonNullable<Json>,"photo_media_id"?: string | null,"position"?: number,"sample_fields"?: (string)[],"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"is_published"?: boolean,"is_sample"?: boolean,"links"?: NonNullable<Json>,"photo_media_id"?: string | null,"position"?: number,"sample_fields"?: (string)[],"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_photo_media_id_fkey"
      columns: ["photo_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "api_catalog": {
                  Row: {
                    "created_at": string | null,"destination_ids": (string)[] | null,"id": string | null,"image": Json | null,"is_published": boolean | null,"is_sample": boolean | null,"is_uae": boolean | null,"kind": string | null,"position": number | null,"price_aed": number | null,"sample_fields": (string)[] | null,"slug": string | null,"stay_ids": (string)[] | null,"unit": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    
                  ]
                },"api_catalog_translations": {
                  Row: {
                    "duration_label": string | null,"item_id": string | null,"locale": string | null,"name": string | null,"status": string | null,"summary": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_translations_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "api_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "catalog_translations_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "catalog_items"
      referencedColumns: ["id"]
    }
                  ]
                },"api_destination_translations": {
                  Row: {
                    "destination_id": string | null,"locale": string | null,"name": string | null,"nights_label": string | null,"region": string | null,"short_line": string | null,"status": string | null,"summary": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "destination_translations_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "api_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "destination_translations_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    }
                  ]
                },"api_destinations": {
                  Row: {
                    "created_at": string | null,"hero_image": Json | null,"id": string | null,"inset_image": Json | null,"is_published": boolean | null,"is_sample": boolean | null,"position": number | null,"sample_fields": (string)[] | null,"slug": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    
                  ]
                },"api_image_translations": {
                  Row: {
                    "alt": string | null,"image_id": string | null,"locale": string | null,"status": string | null
                  }
                  Insert: {
                           "alt"?: string | null,"image_id"?: string | null,"locale"?: string | null,"status"?: string | null
                         }
                        Update: {
                           "alt"?: string | null,"image_id"?: string | null,"locale"?: string | null,"status"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "image_translations_image_id_fkey"
      columns: ["image_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"api_inclusions": {
                  Row: {
                    "inclusion_id": string | null,"label": string | null,"locale": string | null,"position": number | null,"slug": string | null,"status": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inclusion_translations_inclusion_id_fkey"
      columns: ["inclusion_id"]
isOneToOne: false
      referencedRelation: "inclusions"
      referencedColumns: ["id"]
    }
                  ]
                },"api_journey_tier_translations": {
                  Row: {
                    "body": string | null,"duration_label": string | null,"ideal_for": string | null,"ideal_for_label": string | null,"locale": string | null,"name": string | null,"price_label": string | null,"status": string | null,"tagline": string | null,"tier_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "journey_tier_translations_tier_id_fkey"
      columns: ["tier_id"]
isOneToOne: false
      referencedRelation: "api_journey_tiers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journey_tier_translations_tier_id_fkey"
      columns: ["tier_id"]
isOneToOne: false
      referencedRelation: "journey_tiers"
      referencedColumns: ["id"]
    }
                  ]
                },"api_journey_tiers": {
                  Row: {
                    "created_at": string | null,"id": string | null,"image": Json | null,"is_featured": boolean | null,"is_published": boolean | null,"is_sample": boolean | null,"position": number | null,"price_estimate": Json | null,"price_from": Json | null,"sample_fields": (string)[] | null,"slug": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    
                  ]
                },"api_site_settings": {
                  Row: {
                    "body_face": string | null,"charcoal": string | null,"gold": string | null,"ivory": string | null,"logo_key": string | null,"maintenance": boolean | null,"teal": string | null,"title_face": string | null,"white": string | null
                  }
                  Relationships: [
                    
                  ]
                },"api_site_version": {
                  Row: {
                    "requested_seq": number | null
                  }
                  Relationships: [
                    
                  ]
                },"api_stay_blocked_days": {
                  Row: {
                    "day": string | null,"stay_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"api_stay_translations": {
                  Row: {
                    "amenities": (string)[] | null,"bathrooms_label": string | null,"beds_label": string | null,"description": (string)[] | null,"guests_label": string | null,"inclusions": (string)[] | null,"locale": string | null,"neighborhood": string | null,"policy_headings": (string)[] | null,"price_label": string | null,"price_note": string | null,"status": string | null,"stay_id": string | null,"tagline": string | null,"title": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stay_translations_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "api_stays"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stay_translations_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"api_stays": {
                  Row: {
                    "bathrooms": number | null,"bedrooms": number | null,"blocked_dates": (string)[] | null,"created_at": string | null,"destination_id": string | null,"experience_ids": (string)[] | null,"gallery": Json | null,"hero_image": Json | null,"id": string | null,"is_published": boolean | null,"is_sample": boolean | null,"max_guests": number | null,"min_guests": number | null,"min_nights": number | null,"nightly_rate_aed": number | null,"position": number | null,"sample_fields": (string)[] | null,"service_ids": (string)[] | null,"slug": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stays_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "api_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stays_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "destinations"
      referencedColumns: ["id"]
    }
                  ]
                },"api_team": {
                  Row: {
                    "created_at": string | null,"id": string | null,"is_published": boolean | null,"is_sample": boolean | null,"links": Json | null,"photo": Json | null,"position": number | null,"sample_fields": (string)[] | null,"slug": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    
                  ]
                },"api_team_translations": {
                  Row: {
                    "bio": string | null,"locale": string | null,"member_id": string | null,"name": string | null,"role": string | null,"status": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_member_translations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "api_team"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_member_translations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "attach_checkout_session":
{ Args: { "p_payment": string,"p_session": string }; Returns: undefined
                           },
"booking_assert_owner":
{ Args: { "p_actor": string }; Returns: undefined
                           },
"booking_bank_complete":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"booking_bic_ok":
{ Args: { "p": string }; Returns: boolean
                           },
"booking_by_ref":
{ Args: { "p_ref": string }; Returns: Json
                           },
"booking_context":
{ Args: { "p_from": string,"p_locale": string,"p_own_booking"?: string,"p_stay_slug": string,"p_to": string }; Returns: Json
                           },
"booking_date":
{ Args: { "p": Json,"p_key": string,"p_path"?: string,"p_required": boolean }; Returns: string
                           },
"booking_deposit_floor":
{ Args: { "p_deposit": number,"p_deposit_bp": number,"p_grand": number,"p_plan": string }; Returns: number
                           },
"booking_drop_hold":
{ Args: { "p_actor": string,"p_booking": string }; Returns: Json
                           },
"booking_fail":
{ Args: { "p_code": string,"p_detail"?: Json,"p_field"?: string }; Returns: undefined
                           },
"booking_flags":
{ Args: { "b": Database["public"]["Tables"]["bookings"]["Row"] }; Returns: Json
                           },
"booking_gate":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"booking_iban_ok":
{ Args: { "p": string }; Returns: boolean
                           },
"booking_int":
{ Args: { "p": Json,"p_key": string,"p_max": number,"p_min": number,"p_path"?: string }; Returns: number
                           },
"booking_lock":
{ Args: { "p_booking": string }; Returns: {
              "addons_fils": number,
"adults": number,
"airport": string | null,
"arrive": string,
"attention_reason": string | null,
"balance_due_date": string | null,
"balance_due_days": number | null,
"balance_fils": number,
"children": number,
"created_at": string,
"created_by": string | null,
"currency": string,
"deposit_bp": number,
"deposit_fils": number,
"destination_id": string,
"email": string,
"emergency_name": string | null,
"emergency_phone": string | null,
"grand_fils": number,
"guest_name": string,
"hold_expires_at": string | null,
"id": string,
"infants": number,
"is_test": boolean,
"lapse_email_attempts": number,
"lapse_email_claimed_at": string | null,
"lapse_email_sent_at": string | null,
"leave": string,
"link_version": number,
"locale": string,
"nationality": string | null,
"needs_attention": boolean,
"nights_fils": number,
"nights_snapshot": NonNullable<Json>,
"ops_request_id": string | null,
"paid_fils": number,
"phone": string,
"pickup_address": string | null,
"plan": string,
"ref": string,
"requested_at": string | null,
"source": string,
"special_requests": string | null,
"status": string,
"stay_id": string,
"subtotal_fils": number,
"terms_accepted_at": string | null,
"terms_version": string | null,
"updated_at": string,
"vat_bp": number,
"vat_fils": number,
"written_off_fils": number
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"booking_next_status":
{ Args: { "p_deposit": number,"p_grand": number,"p_plan": string,"p_settled": number,"p_status": string }; Returns: string
                           },
"booking_transfer_instructions":
{ Args: { "p_booking": string,"p_locale": string }; Returns: Json
                           },
"booking_txt":
{ Args: { "p": Json,"p_key": string,"p_max": number,"p_min": number,"p_path"?: string,"p_required": boolean }; Returns: string
                           },
"booking_uuid":
{ Args: { "p": Json,"p_key": string,"p_path"?: string,"p_required": boolean }; Returns: string
                           },
"booking_view":
{ Args: { "p_booking": string,"p_expect_test": boolean,"p_locale": string }; Returns: Json
                           },
"booking_window_minutes":
{ Args: { "p_is_test": boolean }; Returns: number
                           },
"booking_withdraw_request":
{ Args: { "p_booking": string,"p_expect_test": boolean }; Returns: Json
                           },
"booking_write":
{ Args: { "p": Json,"p_created_by": string,"p_hold_expires": string,"p_source": string,"p_status": string }; Returns: Json
                           },
"catalog_blank":
{ Args: { "j": Json }; Returns: boolean
                           },
"catalog_entity_meta":
{ Args: { "p_entity": string }; Returns: {
              "base_tbl": string,"cols": (string)[],"fk": string,"req": (string)[],"tr_tbl": string
            }[]
                           },
"catalog_fail":
{ Args: { "p_code": string,"p_detail"?: Json }; Returns: undefined
                           },
"catalog_gaps":
{ Args: { "p_en": Json,"p_locale": string,"p_rec": Json,"p_req": (string)[] }; Returns: Json
                           },
"catalog_invalid":
{ Args: { "p_field": string,"p_locale"?: string }; Returns: undefined
                           },
"catalog_media_live":
{ Args: { "p_id": string }; Returns: boolean
                           },
"catalog_media_ref":
{ Args: { "p_media": string }; Returns: Json
                           },
"catalog_media_uses":
{ Args: { "p_id": string }; Returns: number
                           },
"catalog_need_media":
{ Args: { "p_field": string,"p_id": string }; Returns: undefined
                           },
"catalog_raw":
{ Args: { "p": Json,"p_key": string }; Returns: string
                           },
"catalog_save_translations":
{ Args: { "p_entity": string,"p_id": string,"p_need_en"?: boolean,"p_tr": Json }; Returns: undefined
                           },
"catalog_tr_all":
{ Args: { "p_entity": string,"p_id": string }; Returns: Json
                           },
"catalog_tr_json":
{ Args: { "p_entity": string,"p_id": string,"p_locale": string }; Returns: Json
                           },
"catalog_tr_state":
{ Args: { "p_entity": string,"p_id": string }; Returns: Json
                           },
"catalog_txt":
{ Args: { "p": Json,"p_key": string }; Returns: string
                           },
"catalog_txt_array":
{ Args: { "p": Json }; Returns: (string)[]
                           },
"catalog_uuid_array":
{ Args: { "p": Json }; Returns: (string)[]
                           },
"claim_confirm_slot":
{ Args: { "p_ip_key": string }; Returns: boolean
                           },
"claim_hold_slot":
{ Args: { "p_email_hash": string,"p_ip_hash": string }; Returns: boolean
                           },
"claim_lapse_emails":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"claim_link_slot":
{ Args: { "p_email_hash": string,"p_ip_hash": string }; Returns: boolean
                           },
"claim_stripe_event":
{ Args: { "p_id": string,"p_type": string }; Returns: boolean
                           },
"create_web_booking":
{ Args: { "p": Json }; Returns: Json
                           },
"drop_stripe_event":
{ Args: { "p_id": string }; Returns: undefined
                           },
"finish_lapse_email":
{ Args: { "p_booking": string,"p_error"?: string,"p_ok": boolean }; Returns: undefined
                           },
"finish_stripe_event":
{ Args: { "p_id": string }; Returns: undefined
                           },
"guest_bookings":
{ Args: { "p_email": string,"p_is_test": boolean,"p_locale": string }; Returns: Json
                           },
"import_catalog":
{ Args: { "p": Json }; Returns: Json
                           },
"log_booking_event":
{ Args: { "p_action": string,"p_actor": string,"p_booking": string,"p_detail": Json }; Returns: undefined
                           },
"mark_session_expired":
{ Args: { "p_actor": string,"p_session": string }; Returns: Json
                           },
"media_fold":
{ Args: { "p": string }; Returns: string
                           },
"new_booking_ref":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"open_payment":
{ Args: { "p_booking": string,"p_kind": string,"p_terms_version"?: string }; Returns: Json
                           },
"ops_add_block":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_add_booking_note":
{ Args: { "p_actor": string,"p_body": string,"p_booking": string,"p_request_id": string }; Returns: Json
                           },
"ops_create_booking":
{ Args: { "p": Json,"p_actor": string }; Returns: Json
                           },
"ops_delete":
{ Args: { "p_entity": string,"p_id": string }; Returns: Json
                           },
"ops_delete_block":
{ Args: { "p_id": string }; Returns: Json
                           },
"ops_delete_media":
{ Args: { "p_id": string }; Returns: Json
                           },
"ops_delete_stay_rate":
{ Args: { "p_id": string }; Returns: Json
                           },
"ops_get":
{ Args: { "p_entity": string,"p_id": string }; Returns: Json
                           },
"ops_get_booking":
{ Args: { "p_ref": string }; Returns: Json
                           },
"ops_get_money_settings":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"ops_lapse_holds":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"ops_list":
{ Args: { "p_entity": string }; Returns: Json
                           },
"ops_list_booking_notes":
{ Args: { "p_booking": string }; Returns: Json
                           },
"ops_list_bookings":
{ Args: { "p_after"?: string,"p_arrive_from"?: string,"p_arrive_to"?: string,"p_destination"?: string,"p_limit"?: number,"p_q"?: string,"p_status"?: string }; Returns: Json
                           },
"ops_list_media":
{ Args: { "p_after"?: string,"p_limit"?: number,"p_q"?: string }; Returns: Json
                           },
"ops_publish":
{ Args: { "p_entity": string,"p_id": string,"p_published": boolean }; Returns: Json
                           },
"ops_record_payment":
{ Args: { "p": Json,"p_actor": string }; Returns: Json
                           },
"ops_reorder":
{ Args: { "p_entity": string,"p_ids": (string)[] }; Returns: Json
                           },
"ops_resolve_attention":
{ Args: { "p_actor": string,"p_booking": string,"p_note": string }; Returns: Json
                           },
"ops_save_catalog_item":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_save_destination":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_save_image_alts":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_save_journey_tier":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_save_media":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_save_money_settings":
{ Args: { "p": Json,"p_actor": string }; Returns: Json
                           },
"ops_save_stay":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_save_stay_access":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_save_stay_rate":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_save_team_member":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_set_base_rate":
{ Args: { "p_rate": number,"p_stay": string }; Returns: Json
                           },
"ops_set_booking_status":
{ Args: { "p_actor": string,"p_booking": string,"p_expected_from": string,"p_to": string }; Returns: Json
                           },
"ops_void_payment":
{ Args: { "p_actor": string,"p_payment": string,"p_reason": string }; Returns: Json
                           },
"place_hold":
{ Args: { "p_booking": string,"p_expires": string,"p_from": string,"p_stay": string,"p_to": string }; Returns: string
                           },
"public_booked_nights":
{ Args: Record<PropertyKey, never>; Returns: {
              "day": string,"stay_id": string
            }[]
                           },
"record_dispute":
{ Args: { "p_actor": string,"p_amount_fils": number,"p_charge": string,"p_dispute_id": string,"p_payment_intent": string,"p_reason": string,"p_status": string }; Returns: string
                           },
"record_payment":
{ Args: { "p_actor": string,"p_payment_intent": string,"p_session": string }; Returns: Json
                           },
"record_refund":
{ Args: { "p_actor": string,"p_amount_fils": number,"p_charge": string,"p_payment_intent": string,"p_refund_id": string,"p_status": string }; Returns: string
                           },
"request_web_booking":
{ Args: { "p_booking": string,"p_expect_test": boolean }; Returns: Json
                           },
"save_site_settings":
{ Args: { "p_body_face": string,"p_charcoal": string,"p_currency": string,"p_deposit_percent": number,"p_gold": string,"p_ivory": string,"p_locale": string,"p_logo_media_id": string,"p_maintenance": boolean,"p_owner_id": string,"p_teal": string,"p_title_face": string,"p_vat_percent": number,"p_white": string }; Returns: undefined
                           },
"set_payment_card":
{ Args: { "p_brand": string,"p_charge": string,"p_last4": string,"p_payment": string,"p_presentment_amount": number,"p_presentment_currency": string,"p_wallet": string }; Returns: undefined
                           },
"site_publish_state":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"site_record_hook":
{ Args: { "p_build_uuid": string,"p_result": string }; Returns: undefined
                           },
"site_request_update":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"stay_night_rates":
{ Args: { "p_from": string,"p_stay": string,"p_to": string }; Returns: {
              "night": string,"nightly_rate_aed": number,"rate_id": string,"source": string
            }[]
                           },
"stay_ops_blocked_days":
{ Args: { "p_from": string,"p_stay": string,"p_to": string }; Returns: string[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
