import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../lib/firebaseAdmin';

export async function GET(req) {
  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const listUsersResult = await adminAuth.listUsers(1000);
    const users = [];

    // Fetch isAdmin from Firestore for each user
    for (const userRecord of listUsersResult.users) {
      const docRef = adminDb.collection('users').doc(userRecord.uid);
      const docSnap = await docRef.get();
      const userData = docSnap.exists ? docSnap.data() : {};
      
      users.push({
        uid: userRecord.uid,
        email: userRecord.email,
        isAdmin: userData.isAdmin || false,
        lastSignInTime: userRecord.metadata.lastSignInTime || null,
        creationTime: userRecord.metadata.creationTime || null,
      });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const { email, password, isAdmin } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
    });

    await adminDb.collection('users').doc(userRecord.uid).set({
      isAdmin: isAdmin || false,
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const { uid, isAdmin } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    await adminDb.collection('users').doc(uid).set({
      isAdmin: isAdmin || false,
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    await adminAuth.deleteUser(uid);
    await adminDb.collection('users').doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
