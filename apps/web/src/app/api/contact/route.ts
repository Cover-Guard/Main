import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, company, phone, message, source } = body

    if (!name || !email || !company) {
      return NextResponse.json(
        { error: 'Name, email, and company are required.' },
        { status: 400 }
      )
    }

    const subject =
      source === 'demo'
        ? `New Demo Request from ${name} at ${company}`
        : `New Contact Form Submission from ${name} at ${company}`

    const htmlBody = `
      <h2>${source === 'demo' ? 'Demo Request' : 'Contact Form Submission'}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Name</td><td style="padding:8px;border:1px solid #ddd;">${name}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Email</td><td style="padding:8px;border:1px solid #ddd;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Company</td><td style="padding:8px;border:1px solid #ddd;">${company}</td></tr>
        ${phone ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${phone}</td></tr>` : ''}
        ${message ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Message</td><td style="padding:8px;border:1px solid #ddd;">${message}</td></tr>` : ''}
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Source</td><td style="padding:8px;border:1px solid #ddd;">${source || 'website'}</td></tr>
      </table>
    `

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'CoverGuard <noreply@coverguard.io>',
          to: ['investor@coverguard.io'],
          reply_to: email,
          subject,
          html: htmlBody,
        }),
      })

      if (!emailRes.ok) {
        const err = await emailRes.text()
        console.error('Resend error:', err)
        return NextResponse.json(
          { error: 'Failed to send email. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      console.log('--- CONTACT FORM SUBMISSION (no RESEND_API_KEY set) ---')
      console.log(JSON.stringify({ name, email, company, phone, message, source }, null, 2))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
