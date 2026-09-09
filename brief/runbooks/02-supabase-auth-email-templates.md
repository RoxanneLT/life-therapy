# Supabase Auth Email Templates

Paste these into Supabase Dashboard → Authentication → Email Templates.
Each template uses `{{ .ConfirmationURL }}` which Supabase replaces with the actual link.

---

## 1. Reset Password

**Subject:**
```
Reset Your Password — Life-Therapy
```

**Body HTML:**
```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="https://life-therapy.online/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">
      <h3 style="color: #333; margin: 0 0 16px; font-size: 20px;">Reset Your Password</h3>
      <p>Hi there,</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.online" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.online</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za &middot; +27 71 017 0353</p>
    </div>
  </div>
</body></html>
```

---

## 2. Confirm Signup

**Subject:**
```
Confirm Your Email — Life-Therapy
```

**Body HTML:**
```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="https://life-therapy.online/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">
      <h3 style="color: #333; margin: 0 0 16px; font-size: 20px;">Confirm Your Email</h3>
      <p>Hi there,</p>
      <p>Thanks for signing up! Please confirm your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Confirm Email</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">If you didn't create an account, you can safely ignore this email.</p>
      <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.online" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.online</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za &middot; +27 71 017 0353</p>
    </div>
  </div>
</body></html>
```

---

## 3. Magic Link

**Subject:**
```
Your Login Link — Life-Therapy
```

**Body HTML:**
```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="https://life-therapy.online/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">
      <h3 style="color: #333; margin: 0 0 16px; font-size: 20px;">Your Login Link</h3>
      <p>Hi there,</p>
      <p>Click the button below to sign in to your Life-Therapy account:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Sign In</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.online" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.online</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za &middot; +27 71 017 0353</p>
    </div>
  </div>
</body></html>
```

---

## 4. Change Email Address

**Subject:**
```
Confirm Email Change — Life-Therapy
```

**Body HTML:**
```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="https://life-therapy.online/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">
      <h3 style="color: #333; margin: 0 0 16px; font-size: 20px;">Confirm Email Change</h3>
      <p>Hi there,</p>
      <p>You requested to change your email address. Please confirm this change by clicking the button below:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Confirm Email Change</a>
      </div>
      <p style="color: #6b7280; font-size: 13px;">If you didn't request this change, you can safely ignore this email.</p>
      <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.online" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.online</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za &middot; +27 71 017 0353</p>
    </div>
  </div>
</body></html>
```

---

## 5. Invite User

**Subject:**
```
You're Invited to Life-Therapy
```

**Body HTML:**
```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="https://life-therapy.online/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">
      <h3 style="color: #333; margin: 0 0 16px; font-size: 20px;">You're Invited!</h3>
      <p>Hi there,</p>
      <p>You've been invited to join Life-Therapy. Click the button below to accept the invitation and set up your account:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Accept Invitation</a>
      </div>
      <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.online" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.online</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za &middot; +27 71 017 0353</p>
    </div>
  </div>
</body></html>
```
