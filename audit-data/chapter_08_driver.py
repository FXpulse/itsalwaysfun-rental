"""Chapter 8 — Driver Mobile App. The PWA the team uses on the road."""


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 8, 'Driver Mobile App',
        'Installable PWA for the team on the road. One-stop-at-a-time UX, big tap targets, offline-aware.',
        audience_tags=['Owner', 'Operations', 'Driver'])

    api['add_callout'](doc, 'fact',
        'The driver app shares the codebase but is a mobile-first PWA — installable on iOS '
        'and Android. Drivers see only routes assigned to their vehicle, and only stops on '
        'those routes. RLS on dispatch_stops enforces the boundary.')

    api['add_h2'](doc, '8.1  Surface')

    api['add_kv_table'](doc,
        ['Path', 'Purpose', 'Audience'],
        [
            ('/driver', 'Today + tomorrow route list assigned to the driver\'s vehicle', 'Driver (admin/staff also see)'),
            ('/driver/route/[id]', 'Per-route view: ordered list of stops, status, navigation', 'Driver'),
            ('/driver/inbox', 'Team chat grouped by booking (with @mention badges)', 'Driver'),
            ('/driver/booking/[id]/chat', 'Per-booking thread + inspection section', 'Driver'),
            ('/driver/me', 'Profile, MFA setup, sign out', 'Driver'),
        ],
        col_widths=[2.0, 4.0, 1.1])

    api['add_h2'](doc, '8.2  Bottom navigation')

    api['add_mono_block'](doc, """
   ┌──────────────────────────────────────┐
   │                                      │
   │  Stop card #1                        │
   │    Customer name                     │
   │    Address (tap for Maps)            │
   │    Product · 10:00am – 4:00pm        │
   │  [Navigate]  [Call]                  │
   │  [Photos]    [Chat / Inspect]        │
   │  [✓ Delivered]                       │
   │                                      │
   │  Stop card #2 (collapsed)            │
   │  Stop card #3 (collapsed)            │
   │                                      │
   └──────────────────────────────────────┘
   ┌──────────────────────────────────────┐
   │  🏠 Routes    ✉ Inbox(2)   👤 Me     │
   └──────────────────────────────────────┘
""", title='Driver app — Uber-style mobile layout (shipped 2026-06-16)')

    api['add_h2'](doc, '8.3  Page data sheets')

    api['add_data_sheet'](doc,
        title='/driver  — Today\'s routes',
        subtitle='What\'s the driver doing today and tomorrow.',
        fields=[
            ('Purpose', 'List routes assigned to the driver\'s vehicle for today + tomorrow.'),
            ('UI elements', [
                'Route cards: date, type (Delivery / Pickup), vehicle name, stop count, progress',
                'Tap card → /driver/route/[id]',
                '"Install app" prompt for first-time mobile users',
            ]),
            ('Data tables', 'dispatch_routes (today/tomorrow only), filtered via RLS by driver_or_above + vehicle assignment'),
            ('Server actions', 'None on this page — read-only summary.'),
        ])

    api['add_data_sheet'](doc,
        title='/driver/route/[id]  — Active route',
        subtitle='The actual driving workflow.',
        fields=[
            ('Purpose', 'Step through stops in order. Mark each delivered. Capture proof.'),
            ('UI elements', [
                'Route header: date, total stops, completed count, status (planned/loaded/out/completed)',
                'Stop cards (ordered): customer name + address (tap for Google Maps), product + time, '
                'big "✓ Delivered" button, "Reopen" for accidents',
                'Per-stop expansion: Navigate, Call, Photos, Chat/Inspect',
                'Setup details amber notice if power-supply needed or surface_type non-standard',
            ]),
            ('Data tables', 'dispatch_routes, dispatch_stops, bookings (joined for stop details)'),
            ('Server actions', [
                'markStopDelivered(stopId) — sets delivered_at, revalidates 4 paths (admin/dispatch, '
                '/admin/bookings/[id], /admin/dashboard, /driver/route/[id])',
                'clearStopDelivered(stopId) — accidental tap undo',
                'updateRouteStatus(status) — flip planned → loaded → out → completed',
            ]),
            ('External effects', [
                'When all stops on a delivery route are delivered, related bookings flip to "delivered" status',
                'Admin dashboard live-refreshes via revalidatePath',
            ]),
            ('Notable', 'Photos link → /admin/bookings/[id]/proof?phase=delivery (this is an admin-side '
                         'page but explicitly allowed for drivers). Chat link → /driver/booking/[id]/chat. '
                         'Bottom nav stays fixed across all driver pages (Routes / Inbox / Me).'),
        ])

    api['add_data_sheet'](doc,
        title='/driver/inbox  — Per-booking message threads',
        subtitle='Driver\'s slice of the team chat — only bookings they\'re assigned to.',
        fields=[
            ('Purpose', 'Drivers see and answer questions about their assigned bookings.'),
            ('UI elements', [
                'Booking cards (customer initials avatar, name, product, event date)',
                'Latest message snippet + count badge',
                '@mention badge highlights if last 7 days has a message mentioning current user',
                'Sorted by most-recent-message',
            ]),
            ('Data tables', 'dispatch_stops (filter: assigned to me), booking_internal_messages (latest per booking)'),
            ('Notable', 'Unread badge on the Inbox bottom-nav icon counts @mentions on assigned bookings.'),
        ])

    api['add_data_sheet'](doc,
        title='/driver/booking/[id]/chat',
        subtitle='Full thread + inspection panel for a single booking.',
        fields=[
            ('Purpose', 'Read + post messages on a booking. Also start/view inspections.'),
            ('UI elements', [
                'InternalMessagesThread component (same as /admin/bookings/[id])',
                'BookingInspectionsSection (start delivery / pickup checklist)',
            ]),
            ('Data tables', 'booking_internal_messages, booking_inspections, inspection_templates'),
            ('Server actions', [
                'postInternalMessage(body, mentionUserIds[]) — adds row, sends @mention email if needed',
                'createInspection(bookingId, type, templateId, items, notes) — saves inspection (driver-allowed since 2026-06-16)',
                'suggestTemplateForBooking(bookingId) — returns the right template based on product/category',
            ]),
            ('Notable', 'createInspection used to require staff/admin — relaxed to "driver or above" '
                         'on 2026-06-16 so drivers complete inspections from their app.'),
        ])

    api['add_data_sheet'](doc,
        title='/driver/me  — Profile',
        subtitle='Minimal account page — settings + sign out.',
        fields=[
            ('Purpose', 'Driver self-service for account / security.'),
            ('UI elements', [
                'Avatar card (name + email + role badge)',
                '"Security" link → /admin/settings/security (TOTP setup)',
                '"Call admin" tel: link',
                'Sign out button (POST /admin/logout)',
            ]),
            ('Notable', 'No admin-side data shown — strictly the driver\'s own context.'),
        ])

    api['add_h2'](doc, '8.4  Driver permission model')

    api['add_p'](doc,
        'A user with role=\'driver\' in user_roles has narrower access than staff:')

    api['add_bullet'](doc, '/admin layout redirects drivers AWAY from most pages, allowing only the '
                            '/admin/dispatch/route/[id], /admin/logout, and /admin/bookings/[id]/proof.')
    api['add_bullet'](doc, 'RLS on dispatch_stops filters by current_user_role = driver AND '
                            'vehicle.assigned_driver_id = auth.uid().')
    api['add_bullet'](doc, 'requireDriverOrAbove() is the helper used by server actions drivers can call '
                            '(markStopDelivered, createInspection, postInternalMessage).')

    api['add_callout'](doc, 'good',
        'Driver UX got a major upgrade on 2026-06-16: bottom-nav (Uber-style), dedicated /driver/inbox '
        'and /driver/booking/[id]/chat pages, /driver/me. Drivers no longer need to navigate to '
        '/admin/* surfaces for anything routine. The audit also caught + fixed 4 bugs (1MB body limit '
        'blocking iPhone photo uploads, missing revalidate paths, layout gates, /admin/inspections '
        'requiring staff).')
