const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        
        if (!user) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        
        if (!user) {
            user = await User.create({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                avatar: profile.photos[0].value
            });
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// GitHub OAuth Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: '/auth/github/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // First try to find user by GitHub ID
        let user = await User.findOne({ githubId: profile.id });
        
        if (!user) {
            // If not found by GitHub ID, try to find by email
            user = await User.findOne({ email: profile.emails[0].value });
            
            if (user) {
                // If user exists but doesn't have GitHub ID, update the user
                user.githubId = profile.id;
                user.avatar = profile.photos[0].value;
                await user.save();
            } else {
                // Create new user if not found
                user = await User.create({
                    githubId: profile.id,
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    avatar: profile.photos[0].value
                });
            }
        }
        
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Serialize user for the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport; 