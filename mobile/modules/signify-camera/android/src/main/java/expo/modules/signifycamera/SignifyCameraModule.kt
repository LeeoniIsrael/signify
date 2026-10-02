package expo.modules.signifycamera

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SignifyCameraModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SignifyCamera")
    View(SignifyCameraView::class) {
      Events("onPrediction", "onStatus")
      Prop("active") { view: SignifyCameraView, active: Boolean -> view.setActive(active) }
      Prop("modelPath") { view: SignifyCameraView, path: String -> view.setModelPath(path) }
      Prop("handModelPath") { view: SignifyCameraView, path: String -> view.setHandModelPath(path) }
    }
  }
}
