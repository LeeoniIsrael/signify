import ExpoModulesCore

public class SignifyCameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SignifyCamera")
    View(SignifyCameraView.self) {
      Events("onPrediction", "onStatus")
      Prop("active") { (view: SignifyCameraView, active: Bool) in view.setActive(active) }
      Prop("modelPath") { (view: SignifyCameraView, path: String) in view.loadModel(path) }
      // Android uses MediaPipe; iOS uses the OS's Vision hand pose request.
      Prop("handModelPath") { (_: SignifyCameraView, _: String) in }
    }
  }
}
