"""Chapter 10 — Admin Panel. 81 surfaces, page-by-page data sheets.

Reads audit-data/admin-pages.json (extracted by a discovery agent against the
actual page.tsx + actions.ts files) and renders one data sheet per page.
"""

import json
import os


def _load_pages():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, 'admin-pages.json')
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def render(api):
    doc = api['doc']
    P = api['palette']

    api['add_chapter_divider'](doc, 10, 'Admin Panel — 81 Surfaces',
        'The operator console where the day happens. Every page, every action, '
        'every external effect — documented from the actual code.',
        audience_tags=['Owner', 'Operations', 'Engineer'])

    data = _load_pages()
    if not data:
        api['add_callout'](doc, 'risk',
            'audit-data/admin-pages.json was not generated. Re-run the admin-pages '
            'discovery agent. This chapter intentionally fails loud.')
        return

    api['add_callout'](doc, 'fact',
        f'81 admin route entries documented (across 7 groups), derived by reading every '
        f'page.tsx + actions.ts file and grepping for sendEmail/stripe.*/ghl/revalidatePath/'
        f'logAuditEvent. Trivial pages still listed for completeness.')

    api['add_callout'](doc, 'good',
        'Added 2026-06-18 (not yet in admin-pages.json snapshot): '
        '/admin/drivers/schedule (skill + availability editor for AI route optimizer); '
        'a new "✨ Optimize routes" button on /admin/dispatch/[date] that calls GPT-4o and '
        'shows a proposed plan modal before any DB writes; an ApprovalBanner on /admin/bookings/[id] '
        'with inline approve + reject (reason required) when approval_status=pending; '
        'and an ApprovalThresholdSection on /admin/settings to toggle the high-ticket workflow.')

    # Summary stats
    groups = data.get('groups', [])
    total_pages = sum(len(g.get('pages', [])) for g in groups)
    pages_with_mutations = sum(
        1 for g in groups for p in g.get('pages', [])
        if p.get('server_actions') and len(p['server_actions']) > 0
    )
    pages_with_email = sum(
        1 for g in groups for p in g.get('pages', [])
        if any('email' in str(e).lower() or 'resend' in str(e).lower()
               for e in p.get('external_effects', []))
    )
    pages_with_audit = sum(
        1 for g in groups for p in g.get('pages', [])
        if any('audit' in str(e).lower() for e in p.get('external_effects', []))
    )

    api['add_stats_strip'](doc, [
        (str(total_pages), 'documented pages', P['NAVY']),
        (str(len(groups)), 'functional groups', P['BLUE']),
        (str(pages_with_mutations), 'with mutations', P['TEAL']),
        (str(pages_with_email), 'send emails', P['GREEN']),
        (str(pages_with_audit), 'audit-logged', P['AMBER']),
    ])

    api['add_h2'](doc, '10.1  Group index')

    group_rows = []
    for g in groups:
        n = len(g.get('pages', []))
        group_rows.append((g.get('name', '?'), str(n), g.get('tagline', '')))
    api['add_kv_table'](doc,
        ['Group', '#', 'Tagline'],
        group_rows,
        col_widths=[1.8, 0.5, 4.8])

    # Per-group rendering
    for gi, g in enumerate(groups, start=2):
        api['add_h2'](doc, f'10.{gi}  {g.get("name", "?")}')
        tagline = g.get('tagline', '')
        if tagline:
            api['add_p'](doc, tagline, italic=True, color=P['GRAY'])

        for page in g.get('pages', []):
            _render_page(api, page)


def _render_page(api, page):
    """Render one admin page as a data sheet."""
    P = api['palette']
    path = page.get('path', '?')
    purpose = page.get('purpose', '')

    fields = []
    if purpose:
        fields.append(('Purpose', purpose))

    if page.get('audience'):
        fields.append(('Audience', page['audience']))

    if page.get('ui_elements'):
        fields.append(('UI', page['ui_elements']))

    if page.get('data_tables'):
        fields.append(('Data tables', ', '.join(page['data_tables'])))

    if page.get('server_actions'):
        actions = page['server_actions']
        action_lines = []
        for a in actions:
            if isinstance(a, dict):
                name = a.get('name', '?')
                what = a.get('what', '')
                action_lines.append(f'{name} — {what}' if what else name)
            else:
                action_lines.append(str(a))
        fields.append(('Server actions', action_lines))

    if page.get('business_rules'):
        fields.append(('Business rules', page['business_rules']))

    if page.get('external_effects'):
        fields.append(('External effects', page['external_effects']))

    if page.get('notable_patterns'):
        fields.append(('Notable', page['notable_patterns']))

    api['add_data_sheet'](api['doc'],
        title=path,
        subtitle=None,
        fields=fields)
