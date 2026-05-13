use beadspec_lib::bd::runner::{spawn_managed, SpawnError};
use std::time::Duration;

/// A long-running command that should be killed by the timeout.
/// Uses `sh -c` to ensure portability on macOS/Linux.
#[cfg(not(target_os = "windows"))]
fn long_running_args() -> (&'static str, Vec<&'static str>) {
    ("sh", vec!["-c", "sleep 100"])
}

#[cfg(target_os = "windows")]
fn long_running_args() -> (&'static str, Vec<&'static str>) {
    ("cmd", vec!["/c", "ping -t 127.0.0.1"])
}

// Windows process-group killing is unreliable — skip to avoid indefinite hang.
#[cfg(not(target_os = "windows"))]
#[tokio::test]
async fn spawn_managed_times_out_and_kills_child() {
    let (cmd, args_vec) = long_running_args();
    let args: Vec<&str> = args_vec.to_vec();
    let start = std::time::Instant::now();

    let tmp = std::env::temp_dir();
    let result = spawn_managed(cmd, &args, &tmp, Duration::from_millis(100), &[]).await;

    let elapsed = start.elapsed();
    assert!(
        matches!(result, Err(SpawnError::Timeout { .. })),
        "expected SpawnError::Timeout, got: {:?}",
        result.err()
    );
    // The timeout is 100ms plus up to 2s for child.wait() after kill.
    // We allow 3 seconds total to be resilient on slow CI while still catching hangs.
    assert!(
        elapsed < Duration::from_secs(3),
        "timed out but took too long to return ({elapsed:?})"
    );
}

#[tokio::test]
async fn spawn_managed_returns_output_for_normal_command() {
    let tmp = std::env::temp_dir();
    #[cfg(not(target_os = "windows"))]
    let (cmd, args): (&str, &[&str]) = ("sh", &["-c", "echo hello"]);
    #[cfg(target_os = "windows")]
    let (cmd, args): (&str, &[&str]) = ("cmd", &["/c", "echo hello"]);

    let result = spawn_managed(cmd, args, &tmp, Duration::from_secs(5), &[]).await;

    let out = result.expect("command should succeed");
    assert!(
        String::from_utf8_lossy(&out.stdout).contains("hello"),
        "stdout did not contain 'hello': {:?}",
        String::from_utf8_lossy(&out.stdout)
    );
    assert!(!out.truncated, "output should not be truncated");
}
