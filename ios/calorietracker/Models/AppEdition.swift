import Foundation

/// Switches for this personal fork of Fud AI (Tamaq).
///
/// The upstream app ships paid hosted AI, a tip jar, an online Weekly Challenge
/// and an iCloud backup that all depend on the original author's servers,
/// App Store products and Apple developer account. They stay in the code so
/// upstream fixes keep merging cleanly, but this edition hides them.
nonisolated enum AppEdition {
    /// Plus/Pro hosted AI runs on the original author's server and App Store
    /// subscriptions. Off: the app always uses your own AI provider key (BYOK).
    static let hostedAIEnabled = false

    /// The 18+ Weekly Challenge talks to the original author's server.
    static let weeklyChallengeEnabled = false

    /// iCloud backup needs a CloudKit container, which a free Apple ID
    /// (Personal Team) cannot sign. To turn it on with a paid developer
    /// account: set this to true and add the iCloud (CloudKit) capability with
    /// the container `iCloud.kz.kudabay.tamaq` in Xcode.
    static let iCloudBackupEnabled = false

    /// Settings rows that point at the original author's App Store page,
    /// tip jar, GitHub issues and Discord.
    static let upstreamSupportLinksEnabled = false
}
