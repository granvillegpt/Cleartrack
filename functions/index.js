/**
 * Firebase Cloud Functions for ClearTrack
 * 
 * Implements practitioner-controlled client registration and linking
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

/**
 * Helper: Verify user is authenticated and has practitioner role
 */
async function verifyPractitioner(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }

  const userData = userDoc.data();
  if (userData.role !== 'practitioner') {
    throw new functions.https.HttpsError('permission-denied', 'Only practitioners can perform this action');
  }

  return { uid: context.auth.uid, userData };
}

/**
 * Helper: Verify user is authenticated
 */
async function verifyAuthenticated(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  return context.auth.uid;
}

/**
 * Helper: Generate random numeric code
 */
function generateCode(length = 6) {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
}

/**
 * Helper: Send SMS via Twilio
 * 
 * Configure Twilio by setting these environment variables:
 * - TWILIO_ACCOUNT_SID: Your Twilio Account SID
 * - TWILIO_AUTH_TOKEN: Your Twilio Auth Token
 * - TWILIO_PHONE_NUMBER: Your Twilio phone number (e.g., +1234567890)
 * 
 * To set environment variables:
 * firebase functions:config:set twilio.account_sid="YOUR_SID" twilio.auth_token="YOUR_TOKEN" twilio.phone_number="YOUR_NUMBER"
 * 
 * Or use .env file for local development (requires dotenv package)
 */
async function sendSMS(mobile, message) {
  // Log the SMS attempt
  console.log(`[SMS] Attempting to send to: ${mobile}`);
  console.log(`[SMS] Message: ${message}`);

  // Get Twilio credentials from environment
  // Try both process.env (for local/.env) and functions.config (for deployed)
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || 
                           (functions.config().twilio && functions.config().twilio.account_sid);
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || 
                          (functions.config().twilio && functions.config().twilio.auth_token);
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || 
                            (functions.config().twilio && functions.config().twilio.phone_number);

  if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    try {
      // Dynamically require Twilio (install with: npm install twilio)
      const twilio = require('twilio');
      const client = twilio(twilioAccountSid, twilioAuthToken);
      
      const result = await client.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: mobile
      });
      
      console.log(`[SMS] Sent successfully to ${mobile}. SID: ${result.sid}`);
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error(`[SMS] Error sending to ${mobile}:`, error);
      // Don't throw - we still want the invite created even if SMS fails
      // But log the error for monitoring
      return { success: false, error: error.message };
    }
  } else {
    console.warn('[SMS] Twilio credentials not configured. SMS not sent. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.');
    // In development, you might want to log this but not fail
    return { success: false, error: 'Twilio not configured' };
  }
}

/**
 * Cloud Function: createClientInvite
 * 
 * Practitioner creates an invite for a client with mobile number and verification code
 */
exports.createClientInvite = functions.https.onCall(async (data, context) => {
  try {
    // Verify practitioner
    const { uid: practitionerId } = await verifyPractitioner(context);

    // Validate input
    const { mobile, clientName, note } = data;
    if (!mobile || typeof mobile !== 'string' || mobile.trim().length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Mobile number is required');
    }

    // Basic mobile validation (should be at least 10 digits)
    const cleanMobile = mobile.trim().replace(/\s+/g, '');
    if (cleanMobile.length < 10) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid mobile number format');
    }

    // Generate invite
    const inviteId = db.collection('clientInvites').doc().id;
    const code = generateCode(6);
    const now = admin.firestore.Timestamp.now();
    const expiresAt = new admin.firestore.Timestamp(
      now.seconds + (24 * 60 * 60), // 24 hours
      now.nanoseconds
    );

    // Create invite document
    const inviteData = {
      inviteId,
      mobile: cleanMobile,
      code,
      practitionerId,
      clientUid: null,
      status: 'pending',
      createdAt: now,
      expiresAt,
      clientName: clientName || null,
      note: note || null
    };

    await db.collection('clientInvites').doc(inviteId).set(inviteData);

    // Send SMS
    const appUrl = 'https://app.cleartrack.co.za';
    const inviteLink = `${appUrl}/connect?inviteId=${inviteId}&code=${code}`;
    const smsMessage = `ClearTrack: Your verification code is ${code}. Link: ${inviteLink}`;
    await sendSMS(cleanMobile, smsMessage);

    return {
      inviteId,
      code, // Return for dev/testing
      expiresAt: expiresAt.toDate().toISOString()
    };
  } catch (error) {
    console.error('createClientInvite error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to create client invite');
  }
});

/**
 * Cloud Function: verifyClientInvite
 * 
 * Client verifies their invite code to link to practitioner
 */
exports.verifyClientInvite = functions.https.onCall(async (data, context) => {
  try {
    // Verify authenticated
    const clientUid = await verifyAuthenticated(context);

    // Validate input
    const { mobile, code } = data;
    if (!mobile || typeof mobile !== 'string' || !code || typeof code !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Mobile and code are required');
    }

    const cleanMobile = mobile.trim().replace(/\s+/g, '');

    // Find matching invite
    const invitesSnapshot = await db.collection('clientInvites')
      .where('mobile', '==', cleanMobile)
      .where('code', '==', code)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (invitesSnapshot.empty) {
      throw new functions.https.HttpsError('not-found', 'Invalid invite code or mobile number');
    }

    const inviteDoc = invitesSnapshot.docs[0];
    const inviteData = inviteDoc.data();

    // Check expiration
    const now = admin.firestore.Timestamp.now();
    if (inviteData.expiresAt.toMillis() < now.toMillis()) {
      // Mark as expired
      await inviteDoc.ref.update({ status: 'expired' });
      throw new functions.https.HttpsError('deadline-exceeded', 'Invite code has expired');
    }

    // Update invite
    await inviteDoc.ref.update({
      status: 'accepted',
      clientUid
    });

    // Update client user document
    const userRef = db.collection('users').doc(clientUid);
    await userRef.set({
      practitionerId: inviteData.practitionerId,
      role: 'client'
    }, { merge: true });

    return {
      practitionerId: inviteData.practitionerId,
      inviteId: inviteData.inviteId
    };
  } catch (error) {
    console.error('verifyClientInvite error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to verify invite');
  }
});

/**
 * Cloud Function: createClientRequest
 * 
 * Client creates a request to be assigned to a practitioner
 */
exports.createClientRequest = functions.https.onCall(async (data, context) => {
  try {
    // Verify authenticated
    const clientUid = await verifyAuthenticated(context);

    // Validate input
    const { needs, message } = data;
    if (!needs || !Array.isArray(needs) || needs.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Needs array is required');
    }

    // Ensure user role is set to client
    const userRef = db.collection('users').doc(clientUid);
    await userRef.set({ role: 'client' }, { merge: true });

    // Find appropriate practitioner
    let assignedPractitionerId = null;

    // Query practitioners
    const practitionersSnapshot = await db.collection('users')
      .where('role', '==', 'practitioner')
      .get();

    if (!practitionersSnapshot.empty) {
      // Simple round-robin: sort by rotationIndex or createdAt
      const practitioners = practitionersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by rotationIndex (default 0) or createdAt
      practitioners.sort((a, b) => {
        const aIndex = a.rotationIndex || 0;
        const bIndex = b.rotationIndex || 0;
        if (aIndex !== bIndex) return aIndex - bIndex;
        // If rotationIndex is same, use createdAt
        const aCreated = a.createdAt?.toMillis() || 0;
        const bCreated = b.createdAt?.toMillis() || 0;
        return aCreated - bCreated;
      });

      // Optional: filter by specializations if needs are provided
      // Try to match practitioners with matching specializations first
      let matchingPractitioners = practitioners;
      if (needs && needs.length > 0) {
        const matching = practitioners.filter(p => {
          const practitionerSpecs = p.specializations || [];
          // Check if practitioner has at least one matching specialization
          return needs.some(need => practitionerSpecs.includes(need));
        });
        // If we found matches, use those; otherwise use all practitioners
        if (matching.length > 0) {
          matchingPractitioners = matching;
        }
      }
      
      // Sort matching practitioners by rotationIndex
      matchingPractitioners.sort((a, b) => {
        const aIndex = a.rotationIndex || 0;
        const bIndex = b.rotationIndex || 0;
        if (aIndex !== bIndex) return aIndex - bIndex;
        const aCreated = a.createdAt?.toMillis() || 0;
        const bCreated = b.createdAt?.toMillis() || 0;
        return aCreated - bCreated;
      });
      
      // Pick the first matching practitioner (or first overall if no matches)
      if (matchingPractitioners.length > 0) {
        assignedPractitionerId = matchingPractitioners[0].id;

        // Increment rotation index for next time
        const practitionerRef = db.collection('users').doc(assignedPractitionerId);
        const currentIndex = practitioners[0].rotationIndex || 0;
        await practitionerRef.update({
          rotationIndex: currentIndex + 1
        });
      }
    }

    // Create request
    const requestId = db.collection('clientRequests').doc().id;
    const now = admin.firestore.Timestamp.now();

    const requestData = {
      requestId,
      clientUid,
      needs,
      message: message || null,
      assignedPractitionerId,
      declinedBy: [],
      status: assignedPractitionerId ? 'pending' : 'unassigned',
      createdAt: now,
      updatedAt: now
    };

    await db.collection('clientRequests').doc(requestId).set(requestData);

    return {
      requestId,
      assignedPractitionerId
    };
  } catch (error) {
    console.error('createClientRequest error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to create client request');
  }
});

/**
 * Cloud Function: respondToClientRequest
 * 
 * Practitioner accepts or declines a client request
 */
exports.respondToClientRequest = functions.https.onCall(async (data, context) => {
  try {
    // Verify practitioner
    const { uid: currentPractitionerId } = await verifyPractitioner(context);

    // Validate input
    const { requestId, action } = data;
    if (!requestId || typeof requestId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Request ID is required');
    }
    if (action !== 'accept' && action !== 'decline') {
      throw new functions.https.HttpsError('invalid-argument', 'Action must be "accept" or "decline"');
    }

    // Load request
    const requestRef = db.collection('clientRequests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found');
    }

    const requestData = requestDoc.data();

    // Verify this request is assigned to this practitioner
    if (requestData.assignedPractitionerId !== currentPractitionerId) {
      throw new functions.https.HttpsError('permission-denied', 'This request is not assigned to you');
    }

    const now = admin.firestore.Timestamp.now();

    if (action === 'accept') {
      // Accept: link client to practitioner
      await requestRef.update({
        status: 'accepted',
        updatedAt: now
      });

      // Update client user document
      const userRef = db.collection('users').doc(requestData.clientUid);
      await userRef.set({
        practitionerId: currentPractitionerId
      }, { merge: true });

      return {
        status: 'accepted',
        assignedPractitionerId: currentPractitionerId
      };
    } else {
      // Decline: reassign to next practitioner
      const declinedBy = requestData.declinedBy || [];
      declinedBy.push(currentPractitionerId);

      // Find next practitioner
      const practitionersSnapshot = await db.collection('users')
        .where('role', '==', 'practitioner')
        .get();

      let nextPractitionerId = null;

      if (!practitionersSnapshot.empty) {
        const practitioners = practitionersSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => !declinedBy.includes(p.id)); // Exclude those who declined

        if (practitioners.length > 0) {
          // Sort by rotationIndex
          practitioners.sort((a, b) => {
            const aIndex = a.rotationIndex || 0;
            const bIndex = b.rotationIndex || 0;
            if (aIndex !== bIndex) return aIndex - bIndex;
            const aCreated = a.createdAt?.toMillis() || 0;
            const bCreated = b.createdAt?.toMillis() || 0;
            return aCreated - bCreated;
          });

          nextPractitionerId = practitioners[0].id;

          // Increment rotation index
          const practitionerRef = db.collection('users').doc(nextPractitionerId);
          const currentIndex = practitioners[0].rotationIndex || 0;
          await practitionerRef.update({
            rotationIndex: currentIndex + 1
          });
        }
      }

      // Update request
      if (nextPractitionerId) {
        await requestRef.update({
          assignedPractitionerId: nextPractitionerId,
          declinedBy,
          status: 'pending',
          updatedAt: now
        });
      } else {
        await requestRef.update({
          assignedPractitionerId: null,
          declinedBy,
          status: 'unassigned',
          updatedAt: now
        });
      }

      return {
        status: nextPractitionerId ? 'reassigned' : 'unassigned',
        assignedPractitionerId: nextPractitionerId
      };
    }
  } catch (error) {
    console.error('respondToClientRequest error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to respond to client request');
  }
});

/**
 * Helper: Verify user is authenticated and has admin role
 */
async function verifyAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }

  const userData = userDoc.data();
  if (userData.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can perform this action');
  }

  return { uid: context.auth.uid, userData };
}

/**
 * Helper: Send email via SendGrid or Mailgun
 * 
 * SENDGRID Configuration:
 * - SENDGRID_API_KEY: Your SendGrid API key
 * - FROM_EMAIL: Sender email address (must be verified in SendGrid)
 * 
 * MAILGUN Configuration (alternative):
 * - MAILGUN_API_KEY: Your Mailgun API key
 * - MAILGUN_DOMAIN: Your Mailgun domain
 * - FROM_EMAIL: Sender email address
 * 
 * To set environment variables:
 * firebase functions:config:set sendgrid.api_key="YOUR_KEY" sendgrid.from_email="noreply@cleartrack.co.za"
 * 
 * Or use .env file for local development (requires dotenv package)
 */
async function sendEmail(to, subject, htmlBody, textBody) {
  console.log(`[EMAIL] Attempting to send to: ${to}`);
  console.log(`[EMAIL] Subject: ${subject}`);

  // Try SendGrid first
  const sendgridApiKey = process.env.SENDGRID_API_KEY || 
                        (functions.config().sendgrid && functions.config().sendgrid.api_key);
  const fromEmail = process.env.FROM_EMAIL || 
                   (functions.config().sendgrid && functions.config().sendgrid.from_email) ||
                   'noreply@cleartrack.co.za';

  if (sendgridApiKey) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(sendgridApiKey);
      
      const msg = {
        to: to,
        from: fromEmail,
        subject: subject,
        text: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML if no text body
        html: htmlBody || textBody
      };
      
      await sgMail.send(msg);
      console.log(`[EMAIL] Sent successfully to ${to} via SendGrid`);
      return { success: true, provider: 'sendgrid' };
    } catch (error) {
      console.error(`[EMAIL] SendGrid error:`, error);
      // Fall through to Mailgun or logging
    }
  }

  // Try Mailgun as fallback
  const mailgunApiKey = process.env.MAILGUN_API_KEY || 
                       (functions.config().mailgun && functions.config().mailgun.api_key);
  const mailgunDomain = process.env.MAILGUN_DOMAIN || 
                       (functions.config().mailgun && functions.config().mailgun.domain);

  if (mailgunApiKey && mailgunDomain) {
    try {
      const formData = require('form-data');
      const Mailgun = require('mailgun.js');
      const mailgun = new Mailgun(formData);
      const mg = mailgun.client({
        username: 'api',
        key: mailgunApiKey
      });

      const messageData = {
        from: fromEmail,
        to: to,
        subject: subject,
        text: textBody || htmlBody.replace(/<[^>]*>/g, ''),
        html: htmlBody || textBody
      };

      const response = await mg.messages.create(mailgunDomain, messageData);
      console.log(`[EMAIL] Sent successfully to ${to} via Mailgun. ID: ${response.id}`);
      return { success: true, provider: 'mailgun', id: response.id };
    } catch (error) {
      console.error(`[EMAIL] Mailgun error:`, error);
      // Fall through to logging
    }
  }

  // If no email service configured, log and return
  if (!sendgridApiKey && !mailgunApiKey) {
    console.warn('[EMAIL] No email service configured. Email not sent.');
    console.warn('[EMAIL] Configure SENDGRID_API_KEY or MAILGUN_API_KEY to enable email sending.');
    console.log(`[EMAIL] Would send to: ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Body: ${textBody || htmlBody.substring(0, 100)}...`);
  }

  // Return success even if just logged (for development)
  // In production, you might want to throw an error if email is critical
  return { success: true, provider: 'log-only' };
}

/**
 * Cloud Function: submitPractitionerApplication
 * 
 * Practitioner submits application to join ClearTrack
 */
exports.submitPractitionerApplication = functions.https.onCall(async (data, context) => {
  try {
    // No auth required - anyone can submit an application

    // Validate input
    const {
      firstName,
      lastName,
      email,
      phone,
      practiceName,
      practiceNumber,
      sarsNumber,
      yearsExperience,
      qualifications,
      specializations,
      bio,
      message
    } = data;

    // Validate required fields (check for null/undefined/empty string, but allow 0 for yearsExperience)
    if (!firstName || !lastName || !email || !phone || !practiceName || qualifications === undefined || qualifications === null || qualifications === '') {
      throw new functions.https.HttpsError('invalid-argument', 'Required fields are missing: firstName, lastName, email, phone, practiceName, and qualifications are required');
    }

    // Validate yearsExperience (must be a number, can be 0)
    if (yearsExperience === undefined || yearsExperience === null || typeof yearsExperience !== 'number' || isNaN(yearsExperience)) {
      throw new functions.https.HttpsError('invalid-argument', 'Years of experience must be a valid number');
    }

    if (!specializations || !Array.isArray(specializations) || specializations.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'At least one specialization is required');
    }

    // Create application document
    const applicationId = db.collection('practitionerApplications').doc().id;
    const now = admin.firestore.Timestamp.now();

    const applicationData = {
      applicationId,
      firstName,
      lastName,
      email,
      phone,
      practiceName,
      practiceNumber: practiceNumber || null,
      sarsNumber: sarsNumber || null,
      yearsExperience,
      qualifications,
      specializations,
      bio: bio || null,
      message: message || null,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    await db.collection('practitionerApplications').doc(applicationId).set(applicationData);

    // Send notification email to admin
    const adminEmail = process.env.ADMIN_EMAIL || 
                      (functions.config().admin && functions.config().admin.email) ||
                      'admin@cleartrack.co.za';
    
    const adminEmailSubject = 'New Practitioner Application - ClearTrack';
    const adminEmailText = `A new practitioner application has been submitted.\n\n` +
      `Name: ${firstName} ${lastName}\n` +
      `Email: ${email}\n` +
      `Practice: ${practiceName}\n` +
      `Experience: ${yearsExperience} years\n\n` +
      `Please review the application in the admin dashboard.`;
    
    const adminEmailHtml = `
      <h2>New Practitioner Application</h2>
      <p>A new practitioner application has been submitted.</p>
      <ul>
        <li><strong>Name:</strong> ${firstName} ${lastName}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Practice:</strong> ${practiceName}</li>
        <li><strong>Experience:</strong> ${yearsExperience} years</li>
      </ul>
      <p><a href="https://app.cleartrack.co.za/admin-dashboard.html">Review Application</a></p>
    `;

    // Try to send email, but don't fail the application if email fails
    try {
      await sendEmail(adminEmail, adminEmailSubject, adminEmailHtml, adminEmailText);
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Don't throw - application was saved successfully
    }

    return {
      applicationId,
      status: 'pending',
      message: 'Application submitted successfully. We will review and contact you soon.'
    };
  } catch (error) {
    console.error('submitPractitionerApplication error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    // Provide more detailed error message
    const errorMessage = error.message || 'Failed to submit application';
    console.error('Error details:', errorMessage, error.stack);
    throw new functions.https.HttpsError('internal', `Failed to submit application: ${errorMessage}`);
  }
});

/**
 * Cloud Function: approvePractitionerApplication
 * 
 * Admin approves a practitioner application and generates registration link
 */
exports.approvePractitionerApplication = functions.https.onCall(async (data, context) => {
  try {
    // Verify admin
    await verifyAdmin(context);

    // Validate input
    const { applicationId } = data;
    if (!applicationId || typeof applicationId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Application ID is required');
    }

    // Load application
    const applicationRef = db.collection('practitionerApplications').doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Application not found');
    }

    const applicationData = applicationDoc.data();

    if (applicationData.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Application is not in pending status');
    }

    // Generate registration token and code
    const token = db.collection('practitionerInvites').doc().id;
    const code = generateCode(8);
    const now = admin.firestore.Timestamp.now();
    const expiresAt = new admin.firestore.Timestamp(
      now.seconds + (7 * 24 * 60 * 60), // 7 days
      now.nanoseconds
    );

    // Create invite document
    const inviteData = {
      token,
      code,
      applicationId,
      email: applicationData.email,
      firstName: applicationData.firstName,
      lastName: applicationData.lastName,
      practiceName: applicationData.practiceName,
      status: 'pending',
      createdAt: now,
      expiresAt
    };

    await db.collection('practitionerInvites').doc(token).set(inviteData);

    // Update application status
    await applicationRef.update({
      status: 'approved',
      inviteToken: token,
      approvedAt: now,
      updatedAt: now
    });

    // Send registration email
    const appUrl = 'https://app.cleartrack.co.za';
    const registerLink = `${appUrl}/practitioner-register.html?token=${token}&code=${code}`;
    
    const emailSubject = 'Welcome to ClearTrack - Complete Your Practitioner Registration';
    const emailText = `Dear ${applicationData.firstName},\n\n` +
      `Your application to become a ClearTrack practitioner has been approved!\n\n` +
      `Please complete your registration by clicking the link below:\n${registerLink}\n\n` +
      `Your registration code is: ${code}\n\n` +
      `This link will expire in 7 days.\n\n` +
      `Welcome to ClearTrack!\n\n` +
      `Best regards,\nClearTrack Team`;
    
    const emailHtml = `
      <h2>Welcome to ClearTrack!</h2>
      <p>Dear ${applicationData.firstName},</p>
      <p>Your application to become a ClearTrack practitioner has been approved!</p>
      <p>Please complete your registration by clicking the link below:</p>
      <p><a href="${registerLink}" style="background: #0b7285; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Complete Registration</a></p>
      <p>Your registration code is: <strong>${code}</strong></p>
      <p><small>This link will expire in 7 days.</small></p>
      <p>Welcome to ClearTrack!</p>
      <p>Best regards,<br>ClearTrack Team</p>
    `;

    await sendEmail(applicationData.email, emailSubject, emailHtml, emailText);

    return {
      token,
      code,
      registerLink,
      expiresAt: expiresAt.toDate().toISOString()
    };
  } catch (error) {
    console.error('approvePractitionerApplication error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to approve application');
  }
});

/**
 * Cloud Function: verifyPractitionerInvite
 * 
 * Verify practitioner registration token and code
 */
exports.verifyPractitionerInvite = functions.https.onCall(async (data, context) => {
  try {
    // No auth required - this is for registration

    // Validate input
    const { token, code } = data;
    if (!token || typeof token !== 'string' || !code || typeof code !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Token and code are required');
    }

    // Find matching invite
    const inviteDoc = await db.collection('practitionerInvites').doc(token).get();

    if (!inviteDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Invalid registration link');
    }

    const inviteData = inviteDoc.data();

    if (inviteData.code !== code) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid registration code');
    }

    if (inviteData.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'This registration link has already been used');
    }

    // Check expiration
    const now = admin.firestore.Timestamp.now();
    if (inviteData.expiresAt.toMillis() < now.toMillis()) {
      await inviteDoc.ref.update({ status: 'expired' });
      throw new functions.https.HttpsError('deadline-exceeded', 'Registration link has expired');
    }

    return {
      valid: true,
      email: inviteData.email,
      firstName: inviteData.firstName,
      lastName: inviteData.lastName,
      practiceName: inviteData.practiceName
    };
  } catch (error) {
    console.error('verifyPractitionerInvite error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to verify invite');
  }
});

/**
 * Cloud Function: completePractitionerRegistration
 * 
 * Complete practitioner registration with password
 */
exports.completePractitionerRegistration = functions.https.onCall(async (data, context) => {
  try {
    // No auth required - this is for registration

    // Validate input
    const { token, code, password } = data;
    if (!token || !code || !password) {
      throw new functions.https.HttpsError('invalid-argument', 'Token, code, and password are required');
    }

    if (password.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
    }

    // Verify invite
    const inviteDoc = await db.collection('practitionerInvites').doc(token).get();

    if (!inviteDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Invalid registration link');
    }

    const inviteData = inviteDoc.data();

    if (inviteData.code !== code || inviteData.status !== 'pending') {
      throw new functions.https.HttpsError('permission-denied', 'Invalid or used registration link');
    }

    // Check expiration
    const now = admin.firestore.Timestamp.now();
    if (inviteData.expiresAt.toMillis() < now.toMillis()) {
      await inviteDoc.ref.update({ status: 'expired' });
      throw new functions.https.HttpsError('deadline-exceeded', 'Registration link has expired');
    }

    // Check if user already exists
    const existingUsers = await db.collection('users')
      .where('email', '==', inviteData.email)
      .limit(1)
      .get();

    if (!existingUsers.empty) {
      throw new functions.https.HttpsError('already-exists', 'An account with this email already exists');
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email: inviteData.email,
      password: password,
      emailVerified: false
    });

    // Get application data for additional fields
    let applicationData = {};
    if (inviteData.applicationId) {
      const appDoc = await db.collection('practitionerApplications').doc(inviteData.applicationId).get();
      if (appDoc.exists) {
        applicationData = appDoc.data();
      }
    }

    // Generate practitioner code
    const practitionerCode = `PRAC${generateCode(6)}`;

    // Create user document in Firestore
    const userData = {
      role: 'practitioner',
      email: inviteData.email,
      firstName: inviteData.firstName,
      lastName: inviteData.lastName,
      name: `${inviteData.firstName} ${inviteData.lastName}`,
      practiceName: inviteData.practiceName,
      practitionerCode: practitionerCode,
      practiceNumber: applicationData.practiceNumber || null,
      sarsNumber: applicationData.sarsNumber || null,
      yearsExperience: applicationData.yearsExperience || 0,
      qualifications: applicationData.qualifications || '',
      specializations: applicationData.specializations || [],
      bio: applicationData.bio || '',
      phone: applicationData.phone || '',
      isPubliclyVisible: false,
      createdAt: now,
      rotationIndex: 0
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    // Mark invite as used
    await inviteDoc.ref.update({
      status: 'completed',
      completedAt: now,
      userId: userRecord.uid
    });

    return {
      userId: userRecord.uid,
      email: inviteData.email,
      practitionerCode: practitionerCode
    };
  } catch (error) {
    console.error('completePractitionerRegistration error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'An account with this email already exists');
    }
    throw new functions.https.HttpsError('internal', 'Failed to complete registration');
  }
});

