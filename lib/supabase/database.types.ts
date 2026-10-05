
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
      referencedRelation: "api_stay_blocked_days"
      referencedColumns: ["stay_id"]
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
      referencedRelation: "api_stay_blocked_days"
      referencedColumns: ["stay_id"]
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
                    "body_face": string | null,"charcoal": string | null,"deposit_percent": number | null,"gold": string | null,"id": number,"ivory": string | null,"logo_bytes": string | null,"logo_type": string | null,"maintenance": boolean,"teal": string | null,"title_face": string | null,"vat_percent": number | null,"white": string | null
                  }
                  Insert: {
                    "body_face"?: string | null,"charcoal"?: string | null,"deposit_percent"?: number | null,"gold"?: string | null,"id"?: number,"ivory"?: string | null,"logo_bytes"?: string | null,"logo_type"?: string | null,"maintenance"?: boolean,"teal"?: string | null,"title_face"?: string | null,"vat_percent"?: number | null,"white"?: string | null
                  }
                  Update: {
                    "body_face"?: string | null,"charcoal"?: string | null,"deposit_percent"?: number | null,"gold"?: string | null,"id"?: number,"ivory"?: string | null,"logo_bytes"?: string | null,"logo_type"?: string | null,"maintenance"?: boolean,"teal"?: string | null,"title_face"?: string | null,"vat_percent"?: number | null,"white"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"stay_access": {
                  Row: {
                    "address": string | null,"door_code": string | null,"notes": string | null,"stay_id": string,"updated_at": string,"wifi_name": string | null,"wifi_password": string | null
                  }
                  Insert: {
                    "address"?: string | null,"door_code"?: string | null,"notes"?: string | null,"stay_id": string,"updated_at"?: string,"wifi_name"?: string | null,"wifi_password"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"door_code"?: string | null,"notes"?: string | null,"stay_id"?: string,"updated_at"?: string,"wifi_name"?: string | null,"wifi_password"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stay_access_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: true
      referencedRelation: "api_stay_blocked_days"
      referencedColumns: ["stay_id"]
    },{
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
      referencedRelation: "api_stay_blocked_days"
      referencedColumns: ["stay_id"]
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
      referencedRelation: "api_stay_blocked_days"
      referencedColumns: ["stay_id"]
    },{
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
      referencedRelation: "api_stay_blocked_days"
      referencedColumns: ["stay_id"]
    },{
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
      referencedRelation: "api_stay_blocked_days"
      referencedColumns: ["stay_id"]
    },{
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
                },"site_settings_public": {
                  Row: {
                    "body_face": string | null,"charcoal": string | null,"deposit_percent": number | null,"gold": string | null,"ivory": string | null,"maintenance": boolean | null,"teal": string | null,"title_face": string | null,"vat_percent": number | null,"white": string | null
                  }
                  Insert: {
                           "body_face"?: string | null,"charcoal"?: string | null,"deposit_percent"?: number | null,"gold"?: string | null,"ivory"?: string | null,"maintenance"?: boolean | null,"teal"?: string | null,"title_face"?: string | null,"vat_percent"?: number | null,"white"?: string | null
                         }
                        Update: {
                           "body_face"?: string | null,"charcoal"?: string | null,"deposit_percent"?: number | null,"gold"?: string | null,"ivory"?: string | null,"maintenance"?: boolean | null,"teal"?: string | null,"title_face"?: string | null,"vat_percent"?: number | null,"white"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
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
"claim_link_slot":
{ Args: { "p_email_hash": string,"p_ip_hash": string }; Returns: boolean
                           },
"import_catalog":
{ Args: { "p": Json }; Returns: Json
                           },
"ops_add_block":
{ Args: { "p": Json }; Returns: Json
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
"ops_list":
{ Args: { "p_entity": string }; Returns: Json
                           },
"ops_publish":
{ Args: { "p_entity": string,"p_id": string,"p_published": boolean }; Returns: Json
                           },
"ops_reorder":
{ Args: { "p_entity": string,"p_ids": (string)[] }; Returns: Json
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
