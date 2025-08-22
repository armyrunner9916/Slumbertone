// ios-native/PerfectLoop.swift
import Foundation
import AVFoundation
import MediaPlayer

@objc(PerfectLoop)
class PerfectLoop: NSObject {
  private let engine = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private let mixer  = AVAudioMixerNode()
  private var buffer: AVAudioPCMBuffer?
  private var started = false
  private let cc = MPRemoteCommandCenter.shared()

  // MARK: Load CAF/PCM and arm engine
  @objc func load(_ path: String,
                  resolver resolve: RCTPromiseResolveBlock,
                  rejecter reject: RCTPromiseRejectBlock) {
    do {
      // Accept either a file:// URL string or a plain filesystem path
      let url: URL
      if path.hasPrefix("file://") {
        guard let u = URL(string: path) else {
          reject("LOAD_ERROR", "Bad file URL", nil)
          return
        }
        url = u
      } else {
        url = URL(fileURLWithPath: path)
      }

      let file = try AVAudioFile(forReading: url)
      let fmt  = file.processingFormat

      guard let buf = AVAudioPCMBuffer(pcmFormat: fmt,
                                       frameCapacity: AVAudioFrameCount(file.length)) else {
        throw NSError(domain: "PerfectLoop", code: -1,
                      userInfo: [NSLocalizedDescriptionKey: "Buffer alloc failed"])
      }
      try file.read(into: buf)

      if engine.attachedNodes.isEmpty {
        engine.attach(player)
        engine.attach(mixer)
        engine.connect(player, to: mixer, format: fmt)
        engine.connect(mixer, to: engine.mainMixerNode, format: fmt)
      }
      if !engine.isRunning {
        try engine.start()
      }

      buffer = buf
      configureRemoteCommands()
      resolve(true)
    } catch {
      reject("LOAD_ERROR", error.localizedDescription, error)
    }
  }

  // MARK: Playback
  @objc func play(_ volume: NSNumber) {
    guard let buf = buffer else { return }
    mixer.outputVolume = volume.floatValue
    if !started {
      player.scheduleBuffer(buf, at: nil, options: [.loops], completionHandler: nil)
      player.play()
      started = true
    } else {
      player.play()
    }
  }

  @objc func pause() {
    player.pause()
  }

  @objc func stop() {
    player.stop()
    started = false
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  @objc func setVolume(_ volume: NSNumber) {
    mixer.outputVolume = volume.floatValue
  }

  // MARK: Now Playing / Remote commands
  @objc func setNowPlaying(_ title: NSString) {
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: title,
      MPMediaItemPropertyArtist: "Slumbertone",
      MPNowPlayingInfoPropertyPlaybackRate: 1.0
    ]
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func configureRemoteCommands() {
    cc.playCommand.isEnabled = true
    cc.pauseCommand.isEnabled = true
    cc.stopCommand.isEnabled = true

    cc.playCommand.removeTarget(nil)
    cc.pauseCommand.removeTarget(nil)
    cc.stopCommand.removeTarget(nil)

    cc.playCommand.addTarget { [weak self] _ in
      self?.player.play()
      return .success
    }
    cc.pauseCommand.addTarget { [weak self] _ in
      self?.player.pause()
      return .success
    }
    cc.stopCommand.addTarget { [weak self] _ in
      self?.stop()
      return .success
    }
  }
}